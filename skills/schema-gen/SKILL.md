---
name: schema-gen
description: "Generate valid JSON-LD structured data — LocalBusiness, FAQPage, Service, Product, Organization, Article, BreadcrumbList. Use when adding schema markup, structured data, rich snippets, or /schema-gen."
user-invocable: true
argument-hint: "[page-url-or-file-path]"
---

# Schema Gen

Generate JSON-LD structured data ready for `<script type="application/ld+json">`.

## Supported Types

| Type | When to use |
|------|-------------|
| LocalBusiness | Homepage, contact page — name, address, phone, rating |
| FAQPage | FAQ pages — questions with 30-50 word answers |
| Service | Service pages — name, description, provider, area served |
| Product | Product pages — name, description, price, availability |
| Organization | About page — name, URL, logo, social profiles |
| BreadcrumbList | All pages — navigation path |
| Article | Blog/article pages — headline, author, datePublished, dateModified |

## Steps

1. **Read the page content** to extract relevant data
2. **Detect schema type** from page context (or ask user)
3. **Generate JSON-LD** with all required and recommended properties
4. **Validate** — check against Google's requirements:
   - No deprecated types (HowTo deprecated Sept 2023)
   - FAQ schema: only recommended for government/healthcare per latest guidance
   - All URLs absolute (www version)
   - Dates in ISO 8601 format
5. **Output** ready-to-paste `<script>` block

## Rules
- Always use `https://www.` URLs (match canonical domain)
- Include `dateModified` on all content types
- AggregateRating needs ratingValue + reviewCount
- FAQPage answers: 30-50 words for optimal AI extraction
