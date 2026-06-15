<div align="center">

<br/>

```
███╗   ███╗ █████╗ ███╗   ██╗████████╗██╗███████╗
████╗ ████║██╔══██╗████╗  ██║╚══██╔══╝██║██╔════╝
██╔████╔██║███████║██╔██╗ ██║   ██║   ██║███████╗
██║╚██╔╝██║██╔══██║██║╚██╗██║   ██║   ██║╚════██║
██║ ╚═╝ ██║██║  ██║██║ ╚████║   ██║   ██║███████║
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚══════╝
```

### **Assistant for Your Products**
*24-Hour Hackathon*

<br/>

[![Build in 24hrs](https://img.shields.io/badge/Build%20In-24%20Hours-7B2FBE?style=for-the-badge&logoColor=white)]()
[![Status](https://img.shields.io/badge/Status-Active-00C896?style=for-the-badge)]()

<br/>

---

</div>

## Background

People use all kinds of products every day, including scooters, air conditioners, washing machines, water purifiers, consumer electronics, and industrial equipment. When something goes wrong or requires maintenance, finding the right answer is surprisingly difficult.

Manuals are lengthy and difficult to navigate. Information is scattered across PDFs, websites, videos, and support portals. Most users give up and call a technician for issues they could have resolved themselves if they knew where to find the right information.

> **The information already exists. The problem is access.**

---

## The Challenge

Build a platform where companies can list their products and users can quickly find answers to product-related questions and issues.

Think of it as a support portal where every product has an intelligent assistant built using the product's official documentation and support materials. However, this assistant should not behave like a simple chatbot or search engine. The assistant should function like a **mechanic, technician, or support engineer** who diagnoses issues through investigation and elimination rather than simply returning search results from documentation. The goal is to help users understand, maintain, troubleshoot, and resolve issues with their products using trusted manufacturer-provided information.

---

## Who Uses It

<table>
<tr>
<td width="50%" valign="top">

### Companies

Any company that manufactures or sells a product should be able to:

- Register and create a company account
- Add products with names, categories, descriptions, and images
- Upload support materials for each product:
  - PDF manuals
  - Text documents
  - Images / videos
  - External links (web pages, documentation sites, and YouTube videos)
- Update or remove their content at any time

</td>
<td width="50%" valign="top">

### Users

Anyone who owns or is considering a product should be able to:

- Browse and search for products on the platform
- View product details and available documentation
- Report issues and ask questions
- Receive guidance from the product assistant

</td>
</tr>
</table>

---

## What You Must Build

### `1` — Product Marketplace

A browsable catalog of products on the platform.

| Feature | Description |
|---|---|
| Product Listings | Companies can create product listings |
| Browse & Search | Users can browse and search all products |
| Product Pages | Each product has its own page showing full details and uploaded resources |

---

### `2` — Knowledge Repository

Each product has a set of support materials attached to it.

- Companies can upload **PDFs, documents, images, videos, and external links**
- All uploaded materials are associated with a specific product
- Users can browse and download these materials from the product page
- The assistant uses these materials to investigate issues and provide recommendations

---

### `3` — Intelligent Diagnostic Assistant

Each product should include a dedicated assistant capable of helping users identify and resolve issues through guided investigation.

The assistant should not simply retrieve information from manuals and display it. Instead, it should behave like an experienced technician who **systematically diagnoses problems** using available product knowledge.

#### Diagnostic Workflow

When a user reports a problem, the assistant should:

```
 1  Understand the reported symptoms and context
 2  Identify possible causes from available documentation
 3  Ask follow-up questions to eliminate unlikely causes
 4  Suggest safe inspection steps or tests
 5  Evaluate user responses
 6  Narrow down the most probable root causes
 7  Recommend corrective actions
 8  Provide supporting references from official documentation and resources
```

> The objective is to help users arrive at a likely diagnosis rather than simply presenting search results. Recommendations should be traceable to source materials whenever possible so users can verify the information.

#### Example — Scooter Horn Failure

```
User: "My scooter horn is not working."
```

Instead of immediately providing possible causes, the assistant may ask:

```
◆  Does the headlight work normally?
◆  Is the horn completely silent or weak?
◆  Did the issue start suddenly or gradually?
◆  Has any electrical work been performed recently?
```

Based on the responses, the assistant may suggest:

```
"Please check whether Fuse F3 (10A) is intact. It is located beneath
 the front panel as shown in Figure 4.2 of the service manual."
```

After receiving additional information, the assistant should continue narrowing down possible causes until a probable diagnosis is reached.

---

## Bonus Features

> Teams are not expected to build all of them. **Focus on building a smaller number of features well rather than implementing many incomplete features.**

<table>
<tr>
<td width="50%" valign="top">

**Maintenance Schedules & Product Ownership**
Users can maintain a list of products they own. Users can add products they own to a personal inventory and receive maintenance reminders based on schedules defined by the company. The platform should track upcoming and overdue maintenance tasks, allow users to mark tasks as completed.

---

**Auto-extract Maintenance Schedules**
When a company uploads manuals or service documentation, automatically identify maintenance schedules and tasks from the content. Extract: *"Replace filter every 12 months"* from uploaded documentation and suggest it to the company for approval before publishing.

---

**Voice Input**
Allow users to interact with the assistant using voice. The assistant should be capable of guiding users through troubleshooting procedures hands-free, similar to Alexa/Siri. It should provide detailed instructions and clearly describe component locations. *(e.g., A user places their phone nearby while repairing a scooter. The assistant guides them through each troubleshooting step using voice instructions.)*

---

**Image-based Troubleshooting**
Allow users to upload images of error screens, warning indicators, damaged components, or product parts. The assistant can use these images to assist with diagnosis and troubleshooting.

---

**Video Support**
If a company uploads support videos, the assistant can direct users to the most relevant section. *(e.g., "Watch from 3:25 to 4:10 for the filter replacement procedure.")*

</td>
<td width="50%" valign="top">

**Spare Part Suggestions**
Based on the identified issue or product model, suggest compatible spare parts, replacement components, consumables, and accessories.

---

**Multi-language Support**
Allow users to ask questions and receive guidance in languages other than English.

---

**Warranty and Recall Alerts**
Notify users about warranty expiry dates, product recalls, safety notices, and service campaigns for products they own.

---

**Product Health Score**
Provide companies with insights into common user issues, frequently reported failures, product shortcomings, and support trends.

---

**Visual Guidance**
Present troubleshooting procedures using images, diagrams, flowcharts, step-by-step visual instructions, interactive tutorials, animations, or 3D visualizations to improve the user experience.

</td>
</tr>
</table>
and many more...

---

## What a Great Submission Looks Like

A strong submission will have a clean, working product that a non-technical person can navigate without confusion. Participants should smartly use MOSS in their solution. Participants are encouraged to use AI tools during development. What matters is the quality of the final product and how effectively it solves the problem, not how it was built.

Focus on building features that are **complete, reliable, and genuinely useful**. A smaller set of polished features is preferred over a large number of incomplete ones.

When deciding what to build, ask yourself:

> *"If I owned this product, would I actually use this platform to solve my problem?"*

---

<div align="center">

<br/>

*BEST OF LUCK* &nbsp;·&nbsp; *PClub X MOSS*

<br/>

</div>
