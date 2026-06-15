<div align="center">

# 🚀 Helix

### Product Troubleshooting. Solved by Intelligence.

> An AI-powered diagnostic platform that transforms manuals, documentation, support articles, and technical resources into an intelligent troubleshooting engineer.

<p align="center">
  <img src="https://img.shields.io/badge/Hackathon-24%20Hours-blue?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/MOSS-Powered-success?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Groq-Llama%203.3-purple?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge"/>
</p>

### Built for PClub × MOSS Hackathon

</div>

---

# 📖 Overview

Helix is an intelligent product support platform designed to help users diagnose, troubleshoot, and resolve product issues using official manufacturer documentation.

Instead of behaving like a traditional chatbot, Helix acts as a digital support engineer.

It systematically:

* Understands symptoms
* Retrieves relevant documentation
* Asks follow-up questions
* Eliminates unlikely causes
* Suggests safe inspection steps
* Diagnoses probable issues
* Recommends solutions
* Cites official documentation

The result is a support experience that feels closer to speaking with a technician than searching through PDFs.

---

# 🚨 Problem Statement

Every day users struggle with products such as:

* Routers
* Printers
* Air Conditioners
* Washing Machines
* Scooters
* Water Purifiers
* Consumer Electronics

The information needed to solve their issues already exists.

The challenge is that it is scattered across:

* Product manuals
* Service guides
* Knowledge bases
* Support websites
* Videos
* Technical documentation

Traditional support systems force users to search through hundreds of pages of documentation.

Helix changes that.

---

# 💡 Our Solution

Helix converts manufacturer documentation into a searchable knowledge repository and combines it with AI-powered diagnostic reasoning.

Unlike a standard RAG chatbot:

```text
Question
   ↓
Retrieve Docs
   ↓
Answer
```

Helix follows a diagnostic workflow:

```text
Question
   ↓
Retrieve Docs
   ↓
Investigate
   ↓
Ask Follow-Up Questions
   ↓
Eliminate Possibilities
   ↓
Diagnose
   ↓
Recommend Solution
```

This approach produces more accurate troubleshooting results and mimics the workflow of a real support technician.

---

# ✨ Core Features

## 🏪 Product Marketplace

Companies can:

* Register on the platform
* Create products
* Manage documentation
* Upload support resources

Users can:

* Browse manufacturers
* Explore products
* Search product catalogs
* Access support resources

---

## 📚 Knowledge Repository

Supports:

* PDF Manuals
* Text Documents
* Product Guides
* Images
* Videos
* External Documentation Links

All content is automatically indexed for retrieval.

---

## 🤖 AI Diagnostic Assistant

The heart of Helix.

Features:

* Multi-turn troubleshooting
* Diagnostic reasoning
* Source citations
* Context retention
* Documentation-backed recommendations
* Root cause analysis

Example:

User:

```text
My router is not connecting to the internet.
```

Assistant:

```text
• Are the WAN lights blinking?
• Did the issue start recently?
• Have you restarted the router?
• Are other devices affected?
```

The assistant narrows down causes until a probable diagnosis is reached.

---

## 🌍 Multi-Language Support

Users can interact in multiple languages while documentation remains indexed in English.

Supported examples:

* English
* Hindi
* Spanish
* French
* German

---

## 📄 Citations & Handoff Briefs

Every recommendation includes references to source documents.

When escalation is required, Helix generates:

* Issue Summary
* Diagnostic History
* Recommended Actions
* Documentation References

allowing support teams to continue seamlessly.

---

## 🧰 Product Ownership & Inventory

Users can:

* Track owned products
* Monitor warranties
* View maintenance schedules
* Receive future recall alerts

---

# 📸 Screenshots

## Landing Page

![Landing Page](./screenshots/landing-page.png)

---

## Product Marketplace

![Marketplace](./screenshots/marketplace.png)

---

## Product Inventory

![Inventory](./screenshots/inventory.png)

---

## Company Support Portal

![Support Portal](./screenshots/support-portal.png)

---

# 🏗️ System Architecture

```text
┌───────────────────────────────────────────────┐
│                    HELIX                      │
└───────────────────────────────────────────────┘

                 ┌─────────────┐
                 │   Browser   │
                 │   Next.js   │
                 └──────┬──────┘
                        │
                        ▼

           ┌───────────────────────────┐
           │     API / Server Layer    │
           │      Server Actions       │
           └─────────────┬─────────────┘
                         │

        ┌────────────────┼────────────────┐
        ▼                ▼                ▼

 ┌────────────┐   ┌────────────┐   ┌────────────┐
 │   Prisma   │   │    MOSS    │   │    Groq    │
 │  SQLite DB │   │ Retrieval  │   │ Llama 3.3  │
 └────────────┘   └────────────┘   └────────────┘

                         │
                         ▼

        ┌───────────────────────────────┐
        │ Diagnostic AI Technician      │
        │                               │
        │ • Retrieve Documentation      │
        │ • Ask Follow-Up Questions     │
        │ • Eliminate Possibilities     │
        │ • Diagnose Issues             │
        │ • Recommend Fixes             │
        │ • Cite Sources                │
        └───────────────────────────────┘
```

---

# 🧠 MOSS Integration

MOSS powers every retrieval operation inside Helix.

## Product Catalog Search

```text
User Search
     ↓
MOSS Product Catalog
     ↓
Relevant Products
```

---

## Knowledge Base Retrieval

```text
User Query
     ↓
Product Knowledge Index
     ↓
Relevant Manual Sections
```

---

## Session Memory

```text
Conversation
      ↓
MOSS Session Context
      ↓
Previous Diagnostic Steps
```

---

## Diagnostic Flow

```text
User Reports Issue
          ↓
Retrieve Relevant Docs
          ↓
Retrieve Session Context
          ↓
Generate Questions
          ↓
Analyze Answers
          ↓
Determine Root Cause
          ↓
Recommend Solution
          ↓
Provide Citations
```

---

# ⚙️ Tech Stack

## Frontend

* Next.js 15
* React
* TypeScript
* CSS

## Backend

* Server Actions
* API Routes
* Node.js

## Database

* Prisma
* SQLite

## Retrieval Layer

* MOSS

## AI Layer

* Groq SDK
* Llama 3.3 70B

## Authentication

* NextAuth

## Document Processing

* pdf-parse

---

# 📂 Project Structure

```bash
src/
├── app/
├── actions/
├── components/
├── lib/
├── types/
├── prisma/
└── uploads/
```

---

# 🚀 Getting Started

## Installation

```bash
git clone https://github.com/your-repository/helix.git

cd helix

npm install
```

---

## Environment Variables

```env
DATABASE_URL=

NEXTAUTH_SECRET=

MOSS_PROJECT_ID=

MOSS_PROJECT_KEY=

GROQ_API_KEY=
```

---

## Run Development Server

```bash
npm run dev
```

---

# 🎯 Future Scope

* Voice Troubleshooting
* Image-Based Diagnostics
* Maintenance Reminder Engine
* Spare Parts Recommendation System
* Recall Alert System
* Warranty Monitoring
* Product Health Analytics

---

# 🏆 Why Helix?

Most support systems provide answers.

Helix provides diagnosis.

Most chatbots retrieve documentation.

Helix investigates problems.

Most assistants stop at information.

Helix guides users toward resolution.

---

# 👥 Team

## Team Helix

### Arpit

### Ashutosh Mani Shukla

---

<div align="center">

### Built with ❤️ using MOSS, Next.js, Groq & TypeScript

#### PClub × MOSS Hackathon 2026

</div>
