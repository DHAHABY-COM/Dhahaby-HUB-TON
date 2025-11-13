import dotenv from "dotenv";
import pool from "../components/db.js";

dotenv.config();

const policies = [
  {
    slug: "terms-conditions-user-agreement",
    title: "Terms & Conditions / User Agreement",
    header: "Terms & Conditions",
    docTitle: "Dhahaby App – Terms & Conditions / User Agreement (UAE)",
    body: `Effective Date: 01/10/2025
Last Updated: 10/10/2025

This Terms & Conditions Agreement governs use of Dhahaby services in the UAE, including eligibility, user obligations, service scope, loan terms, fees, collateral handling, KYC/AML controls, and data protection commitments. Users must review and accept all applicable terms before proceeding with any financial action through the platform.`,
    order: 10,
  },
  {
    slug: "loan-credit-terms-policy",
    title: "Loan / Credit Terms Policy",
    header: "Loan / Credit Terms",
    docTitle: "Dhahaby – Loan / Credit Terms Policy (UAE)",
    body: `Defines eligibility, underwriting dependency, repayment obligations, default treatment, and pre-closure conditions for gold-backed credit facilitated through Dhahaby and partner institutions in the UAE.`,
    order: 20,
  },
  {
    slug: "fees-charges-disclosure",
    title: "Fees & Charges Disclosure",
    header: "Fees & Charges",
    docTitle: "Dhahaby – Fees & Charges Disclosure (UAE)",
    body: `Describes applicable fees including appraisal, processing, storage/custody, insurance, payment failure penalties, and any partner-bank/network charges. Dhahaby commits to pre-confirmation fee transparency.`,
    order: 30,
  },
  {
    slug: "privacy-policy-data-protection",
    title: "Privacy Policy / Data Protection",
    header: "Privacy Policy",
    docTitle: "Dhahaby – Privacy Policy / Data Protection (UAE)",
    body: `Explains what personal data is collected, why it is processed, lawful sharing with regulated partners, retention controls, and security measures aligned with UAE Personal Data Protection requirements.`,
    order: 40,
  },
  {
    slug: "aml-kyc-fraud-prevention-policy",
    title: "AML / KYC / Fraud Prevention Policy",
    header: "AML / KYC Policy",
    docTitle: "Dhahaby – AML / KYC / Fraud Prevention Policy (UAE)",
    body: `Covers identity verification, enhanced due diligence, suspicious activity monitoring, and account restrictions for fraudulent or non-compliant behavior under applicable AML/CFT rules.`,
    order: 50,
  },
  {
    slug: "dispute-resolution-complaints-policy",
    title: "Dispute Resolution & Complaints Policy",
    header: "Disputes & Complaints",
    docTitle: "Dhahaby – Dispute Resolution & Complaints Policy (UAE)",
    body: `Outlines complaint intake channels, case acknowledgment and handling workflow, escalation paths, and recordkeeping commitments for customer dispute management.`,
    order: 60,
  },
  {
    slug: "consumer-protection-transparency-notice",
    title: "Consumer Protection / Transparency Notice",
    header: "Consumer Protection",
    docTitle: "Dhahaby – Consumer Protection / Transparency Notice (UAE)",
    body: `Summarizes fair-treatment principles, key disclosure standards, informed consent expectations, and status communication commitments for customer-facing workflows.`,
    order: 70,
  },
  {
    slug: "collateral-security-insurance-policy",
    title: "Collateral / Security / Insurance Policy",
    header: "Collateral Security",
    docTitle: "Dhahaby – Collateral / Security / Insurance Policy (UAE)",
    body: `Describes custody controls, insurance coverage while assets are held, release conditions after settlement, and default-recovery actions where contractually and legally permitted.`,
    order: 80,
  },
  {
    slug: "risk-disclosure",
    title: "Risk Disclosure",
    header: "Risk Disclosure",
    docTitle: "Dhahaby – Risk Disclosure (UAE)",
    body: `Highlights key risks including valuation variability, repayment/default risk, operational downtime, regulatory changes, and third-party dependency risks.`,
    order: 90,
  },
  {
    slug: "governing-law-jurisdiction",
    title: "Governing Law & Jurisdiction",
    header: "Governing Law",
    docTitle: "Dhahaby – Governing Law & Jurisdiction (UAE)",
    body: `Specifies that services and terms are governed by UAE law and subject to competent UAE jurisdiction, except where mandatory law requires otherwise.`,
    order: 100,
  },
  {
    slug: "termination-suspension-policy",
    title: "Termination / Suspension Policy",
    header: "Termination Policy",
    docTitle: "Dhahaby – Termination / Suspension Policy (UAE)",
    body: `Defines grounds for suspension/termination, user-initiated closure conditions, impact on account access, and possible reinstatement requirements.`,
    order: 110,
  },
  {
    slug: "regulatory-disclosures",
    title: "Regulatory Disclosures",
    header: "Regulatory Disclosures",
    docTitle: "Dhahaby – Regulatory Disclosures (UAE)",
    body: `Provides summary disclosures on service model, partner dependencies, and compliance posture, and may be updated with regulatory changes.`,
    order: 120,
  },
];

const run = async () => {
  const connection = await pool.getConnection();
  try {
    for (const p of policies) {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(
        `INSERT INTO legal_policies (
          policy_slug, title, header_title, document_title, body, effective_date, last_updated_date, display_order, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          header_title = VALUES(header_title),
          document_title = VALUES(document_title),
          body = VALUES(body),
          effective_date = VALUES(effective_date),
          last_updated_date = VALUES(last_updated_date),
          display_order = VALUES(display_order),
          is_active = VALUES(is_active),
          updated_at = CURRENT_TIMESTAMP`,
        [p.slug, p.title, p.header, p.docTitle, p.body, "2025-10-01", "2025-10-10", p.order]
      );
    }
    console.log(`✅ Seeded legal policies: ${policies.length}`);
  } catch (error) {
    console.error("❌ Failed to seed legal policies:", error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
};

run();
