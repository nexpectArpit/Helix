"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { safeCreateIndex, safeAddDocs, safeQuery, moss, pollJobStatus, safeDeleteIndex } from "@/lib/moss";
import { revalidatePath } from "next/cache";

export interface ProductResult {
  success: boolean;
  error?: string;
  productId?: string;
}

/**
 * Indexes a product in the global Moss "product-catalog" index.
 */
async function syncProductToMossCatalog(product: {
  id: string;
  name: string;
  category: string;
  description: string;
  companyId: string;
  companyName: string;
}) {
  try {
    const doc = {
      id: product.id,
      text: `Name: ${product.name}\nCategory: ${product.category}\nCompany: ${product.companyName}\nDescription: ${product.description}`,
      metadata: {
        company_id: product.companyId,
        category: product.category,
        brand: product.companyName
      }
    };

    const indexList = await moss.listIndexes();
    const indexExists = indexList.some((idx: any) => idx.name === "product-catalog");

    let result;
    if (indexExists) {
      result = await safeAddDocs("product-catalog", [doc]);
    } else {
      result = await safeCreateIndex("product-catalog", [doc]);
    }

    if (result.success && result.jobId) {
      // Poll in background or wait. We poll for a few seconds just to be sure.
      pollJobStatus(result.jobId, 10, 1000).catch(err => {
        console.error(`[MOSS_SYNC_POLL_ERROR] Background poll failed for product ${product.id}:`, err);
      });
    }
  } catch (error) {
    console.error(`[MOSS_SYNC_ERROR] Failed to sync product ${product.id} to Moss:`, error);
  }
}

/**
 * Create a new product.
 */
export async function createProduct(formData: FormData): Promise<ProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
      return { success: false, error: "Unauthorized. Company Admin access required." };
    }

    const name = formData.get("name")?.toString().trim();
    const category = formData.get("category")?.toString().trim();
    const description = formData.get("description")?.toString().trim();
    const imageUrl = formData.get("imageUrl")?.toString().trim() || null;
    const warrantyDays = parseInt(formData.get("warrantyDays")?.toString() || "365", 10);

    if (!name || !category || !description) {
      return { success: false, error: "Name, category, and description are required." };
    }

    const product = await db.product.create({
      data: {
        name,
        category,
        description,
        image: imageUrl,
        warrantyDays,
        companyId: session.user.companyId
      },
      include: {
        company: true
      }
    });

    // Sync to Moss search catalog asynchronously
    await syncProductToMossCatalog({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      companyId: product.companyId,
      companyName: product.company.name
    });

    revalidatePath("/products");
    revalidatePath("/dashboard/products");

    return { success: true, productId: product.id };
  } catch (error: any) {
    console.error("[CREATE_PRODUCT_ERROR]", error);
    return { success: false, error: error.message || "Failed to create product." };
  }
}

/**
 * Update an existing product.
 */
export async function updateProduct(productId: string, formData: FormData): Promise<ProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
      return { success: false, error: "Unauthorized." };
    }

    const name = formData.get("name")?.toString().trim();
    const category = formData.get("category")?.toString().trim();
    const description = formData.get("description")?.toString().trim();
    const imageUrl = formData.get("imageUrl")?.toString().trim() || null;
    const warrantyDays = parseInt(formData.get("warrantyDays")?.toString() || "365", 10);

    if (!name || !category || !description) {
      return { success: false, error: "Name, category, and description are required." };
    }

    // Verify ownership
    const existing = await db.product.findUnique({
      where: { id: productId }
    });

    if (!existing || existing.companyId !== session.user.companyId) {
      return { success: false, error: "Product not found or access denied." };
    }

    const warrantyDaysChanged = existing.warrantyDays !== warrantyDays;

    const product = await db.product.update({
      where: { id: productId },
      data: {
        name,
        category,
        description,
        image: imageUrl,
        warrantyDays
      },
      include: {
        company: true
      }
    });

    // If warranty days changed, cascade update to all UserProduct instances
    if (warrantyDaysChanged) {
      const userProducts = await db.userProduct.findMany({
        where: { productId }
      });
      for (const up of userProducts) {
        if (up.purchaseDate) {
          const newExpiry = new Date(up.purchaseDate);
          newExpiry.setDate(newExpiry.getDate() + warrantyDays);
          await db.userProduct.update({
            where: { id: up.id },
            data: { warrantyExpiry: newExpiry }
          });
          revalidatePath(`/my-products/${up.id}`);
        }
      }
      revalidatePath("/my-products");
    }

    // Sync changes to Moss
    await syncProductToMossCatalog({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      companyId: product.companyId,
      companyName: product.company.name
    });

    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath("/dashboard/products");

    return { success: true, productId: product.id };
  } catch (error: any) {
    console.error("[UPDATE_PRODUCT_ERROR]", error);
    return { success: false, error: error.message || "Failed to update product." };
  }
}

/**
 * Delete a product.
 */
export async function deleteProduct(productId: string): Promise<ProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
      return { success: false, error: "Unauthorized." };
    }

    // Verify ownership
    const existing = await db.product.findUnique({
      where: { id: productId }
    });

    if (!existing || existing.companyId !== session.user.companyId) {
      return { success: false, error: "Product not found or access denied." };
    }

    // Delete related database records inside transaction
    await db.$transaction(async (tx) => {
      // Delete uploads
      await tx.upload.deleteMany({ where: { productId } });
      // Delete sessions
      await tx.diagnosticSession.deleteMany({ where: { productId } });
      // Delete product
      await tx.product.delete({ where: { id: productId } });
    });

    // Remove from Moss product-catalog
    try {
      await moss.deleteDocs("product-catalog", [productId]);
    } catch (err) {
      console.error(`[MOSS_DELETE_DOC_ERROR] Failed to delete product ${productId} from catalog index:`, err);
    }

    // Clean up product's own per-product knowledge base index (Priority 1A)
    try {
      const indexName = `product-${productId}-kb`;
      await safeDeleteIndex(indexName);
    } catch (err: any) {
      console.error(`[MOSS_DELETE_PRODUCT_DOCS_ERROR] Failed to delete per-product index:`, err.message);
    }

    revalidatePath("/products");
    revalidatePath("/dashboard/products");

    return { success: true };
  } catch (error: any) {
    console.error("[DELETE_PRODUCT_ERROR]", error);
    return { success: false, error: error.message || "Failed to delete product." };
  }
}

/**
 * Retrieve products, with optional Moss-powered hybrid search.
 */
export async function getProducts(queryText?: string, categoryFilter?: string, companyId?: string) {
  try {
    let productIds: string[] | null = null;
    let relevanceScores: Record<string, number> = {};

    // 1. If queryText is provided, retrieve matching IDs from Moss
    if (queryText && queryText.trim()) {
      const trimmedQuery = queryText.trim();
      
      // Check if catalog index exists first
      const indexList = await moss.listIndexes();
      const indexExists = indexList.some((idx: any) => idx.name === "product-catalog");

      if (indexExists) {
        let options: any = { top_k: 20, alpha: 0.6 };
        
        // Setup filter conditions for Moss
        const filterConditions: any[] = [];
        if (categoryFilter && categoryFilter !== "All") {
          filterConditions.push({
            field: "category",
            condition: { $eq: categoryFilter }
          });
        }
        if (companyId) {
          filterConditions.push({
            field: "company_id",
            condition: { $eq: companyId }
          });
        }

        if (filterConditions.length > 0) {
          if (filterConditions.length === 1) {
            options.filter = filterConditions[0];
          } else {
            options.filter = {
              $and: filterConditions
            };
          }
        }

        const results = await safeQuery("product-catalog", trimmedQuery, options);
        if (results && results.docs) {
          productIds = results.docs.map((doc: any) => doc.id);
          results.docs.forEach((doc: any) => {
            relevanceScores[doc.id] = doc.score || 0;
          });
        }
      }
    }

    // 2. Query SQLite database
    let whereClause: any = {};
    const hasMossResults = productIds !== null && productIds.length > 0;

    if (hasMossResults) {
      whereClause.id = { in: productIds };
    } else {
      // Fallback: search using SQLite contains match
      if (queryText && queryText.trim()) {
        const trimmed = queryText.trim();
        whereClause.OR = [
          { name: { contains: trimmed } },
          { description: { contains: trimmed } },
          { category: { contains: trimmed } }
        ];
      }
      if (categoryFilter && categoryFilter !== "All") {
        whereClause.category = categoryFilter;
      }
    }

    if (companyId) {
      whereClause.companyId = companyId;
    }

    const dbProducts = await db.product.findMany({
      where: whereClause,
      include: {
        company: true
      }
    });

    // 3. Sort by Moss relevance score if search was performed
    if (productIds !== null) {
      dbProducts.sort((a, b) => {
        const scoreA = relevanceScores[a.id] || 0;
        const scoreB = relevanceScores[b.id] || 0;
        return scoreB - scoreA; // Descending relevance
      });
    } else {
      // Default: sort by newest created
      dbProducts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return dbProducts;
  } catch (error) {
    console.error("[GET_PRODUCTS_ERROR]", error);
    // Return empty list on failure to keep UI stable
    return [];
  }
}

/**
 * Fetch all companies with their product counts.
 */
export async function getCompanies() {
  try {
    const companies = await db.company.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    return companies;
  } catch (error) {
    console.error("[GET_COMPANIES_ERROR]", error);
    return [];
  }
}

/**
 * Fetch a single company by ID.
 */
export async function getCompanyById(id: string) {
  try {
    const company = await db.company.findUnique({
      where: { id },
      include: {
        products: true
      }
    });
    return company;
  } catch (error) {
    console.error("[GET_COMPANY_BY_ID_ERROR]", error);
    return null;
  }
}

export async function updateCompany(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
      return { success: false, error: "Unauthorized." };
    }

    const name = formData.get("name")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || null;

    if (!name) {
      return { success: false, error: "Company name is required." };
    }

    await db.company.update({
      where: { id: session.user.companyId },
      data: { name, description }
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("[UPDATE_COMPANY_ERROR]", error);
    return { success: false, error: error.message || "Failed to update company profile." };
  }
}
