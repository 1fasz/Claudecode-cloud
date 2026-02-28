/**
 * Company Knowledge Base
 * Update this file with accurate information for both companies.
 * This is injected into the AI system prompt for every call.
 */

const COMPANIES = {
  cslegaltech: {
    name: "CS Legal Tech",
    website: "https://cslegaltech.com",
    tagline: "Legal Technology Solutions",
    description: `CS Legal Tech is a legal technology company that provides innovative
software solutions and services to law firms, corporate legal departments,
and legal professionals. We help modernize legal workflows, improve efficiency,
and deliver better outcomes for legal teams.`,
    services: [
      "Legal practice management software",
      "Document automation and management",
      "E-discovery and litigation support",
      "Contract lifecycle management",
      "Legal billing and time tracking solutions",
      "Compliance and regulatory technology",
      "Legal AI and analytics tools",
      "Technology consulting for law firms",
    ],
    contactEmail: "info@cslegaltech.com",
    website: "https://cslegaltech.com",
    // TODO: Fill in actual phone, address, hours from cslegaltech.com
    phone: null,
    address: null,
    businessHours: "Monday–Friday, 9:00 AM – 5:00 PM Eastern Time",
    appointmentTypes: [
      "Product demo",
      "Consultation call",
      "Technical support",
      "Sales inquiry",
      "Partnership discussion",
    ],
  },

  vulcancloud: {
    name: "Vulcan Cloud",
    website: "https://vulcancloud.com",
    tagline: "Cloud Infrastructure & Solutions",
    description: `Vulcan Cloud is a cloud computing and infrastructure company that delivers
scalable, secure, and high-performance cloud solutions to businesses of all sizes.
We specialize in cloud migration, managed services, and custom cloud architecture
designed to accelerate digital transformation.`,
    services: [
      "Cloud infrastructure and hosting",
      "Cloud migration services",
      "Managed cloud services",
      "DevOps and CI/CD pipelines",
      "Cloud security and compliance",
      "Disaster recovery and backup",
      "Multi-cloud strategy and consulting",
      "24/7 infrastructure monitoring and support",
    ],
    contactEmail: "info@vulcancloud.com",
    website: "https://vulcancloud.com",
    // TODO: Fill in actual phone, address, hours from vulcancloud.com
    phone: null,
    address: null,
    businessHours: "Monday–Friday, 9:00 AM – 5:00 PM Eastern Time",
    appointmentTypes: [
      "Cloud assessment",
      "Migration consultation",
      "Technical demo",
      "Support escalation",
      "Sales inquiry",
    ],
  },
};

/**
 * Build the company context string injected into the AI prompt.
 */
function buildCompanyContext() {
  return `
=== COMPANY INFORMATION ===

You represent two companies. When a caller asks about a specific company, focus on that one.
If unclear which company they're calling for, ask them.

--- Company 1: CS Legal Tech ---
Website: ${COMPANIES.cslegaltech.website}
Description: ${COMPANIES.cslegaltech.description.trim()}
Services offered:
${COMPANIES.cslegaltech.services.map((s) => `  - ${s}`).join("\n")}
Business hours: ${COMPANIES.cslegaltech.businessHours}
Email: ${COMPANIES.cslegaltech.contactEmail}
Appointment types: ${COMPANIES.cslegaltech.appointmentTypes.join(", ")}

--- Company 2: Vulcan Cloud ---
Website: ${COMPANIES.vulcancloud.website}
Description: ${COMPANIES.vulcancloud.description.trim()}
Services offered:
${COMPANIES.vulcancloud.services.map((s) => `  - ${s}`).join("\n")}
Business hours: ${COMPANIES.vulcancloud.businessHours}
Email: ${COMPANIES.vulcancloud.contactEmail}
Appointment types: ${COMPANIES.vulcancloud.appointmentTypes.join(", ")}

=== END COMPANY INFORMATION ===
`.trim();
}

module.exports = { COMPANIES, buildCompanyContext };
