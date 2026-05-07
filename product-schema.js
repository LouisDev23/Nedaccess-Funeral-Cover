// Schema-driven demo product config (versioned)
// Exported as a global for simplicity in this vanilla JS demo.
window.productSchema = {
  version: 1,
  productKey: "funeral_cover_tcs",
  icon: "Shield",
  title: "MyCover Funeral",
  description:
    "Application for MyCover Funeral with dynamic plan selection and dependant capture",
  workflow: {
    initial: "APPLICATION",
    states: [
      {
        key: "APPLICATION",
        label: "Application",
        editableBy: ["user", "agent"],
        transitions: [
          { to: "SUBMITTED", action: "submit" },
          { to: "CANCELLED", action: "cancel" },
        ],
      },
      {
        key: "SUBMITTED",
        label: "Submitted",
        editableBy: ["admin", "ops"],
        transitions: [
          { to: "COMPLETED", action: "complete" },
          { to: "CANCELLED", action: "cancel" },
        ],
      },
      { key: "COMPLETED", label: "Completed", terminal: true },
      { key: "CANCELLED", label: "Cancelled", terminal: true },
    ],
  },
  sections: [
    {
      key: "setup_plan",
      title: "Set up your funeral plan",
      description: "Select who you would like to cover and enter your cover amount",
      fields: [
        {
          key: "cover_plan",
          label: "Please select who you would like to cover",
          type: "radio",
          required: true,
          optionsCategory: "cover_plan_options",
        },
        {
          key: "dependants_restriction_notice",
          label: "Please note",
          type: "info",
          content:
            "If you select 'Just my dependants', you can only cover: spouse, parents, grandparents, and domestic workers.",
          visibleWhen: {
            all: [
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "dependants_only",
              },
            ],
          },
        },
        {
          key: "self_cover_amount",
          label: "Your cover (N$)",
          type: "numeric",
          format: "currency",
          min: 5000,
          max: 100000,
          placeholder: "N$ 5 000 – N$ 100 000",
          visibleWhen: {
            any: [
              { fieldKey: "setup_plan.cover_plan", operator: "eq", value: "myself" },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
          requiredWhen: {
            any: [
              { fieldKey: "setup_plan.cover_plan", operator: "eq", value: "myself" },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
        },
        {
          key: "date_of_birth",
          label: "Date of birth",
          type: "date",
          required: true,
          prefillFromKyc: "identities.date_of_birth",
          helperText:
            "Required to determine optional benefits eligibility (must be 18-75 years old)",
        },
        {
          key: "education_consent",
          label: "Customer consent (Nedbank EducationContent)",
          type: "boolean",
          required: true,
          userside: false,
          helperText:
            "Captured automatically when the customer accepts the product information consent on opening the form.",
        },
        {
          key: "education_consent_at",
          label: "Education consent timestamp",
          type: "text",
          required: false,
          userside: false,
        },
      ],
    },
    {
      key: "previous_policy",
      title: "Previous Policy Information",
      description:
        "If you cancelled a previous funeral policy to take up this one, provide details to adjust your waiting period",
      fields: [
        {
          key: "has_cancelled_previous_policy",
          label:
            "Have you cancelled a previous funeral policy to take up this policy?",
          type: "boolean",
          required: true,
          helperText:
            "If yes, you can provide proof and your waiting period may be adjusted based on the time already served with your previous insurer.",
        },
        {
          key: "previous_insurer_name",
          label: "Previous insurer name",
          type: "text",
          required: false,
          requiredWhen: {
            any: [
              {
                fieldKey: "previous_policy.has_cancelled_previous_policy",
                operator: "eq",
                value: true,
              },
            ],
          },
          visibleWhen: {
            all: [
              {
                fieldKey: "previous_policy.has_cancelled_previous_policy",
                operator: "eq",
                value: true,
              },
            ],
          },
          helperText: "Name of your previous funeral cover provider",
        },
        {
          key: "previous_policy_number",
          label: "Previous policy number",
          type: "text",
          required: false,
          requiredWhen: {
            any: [
              {
                fieldKey: "previous_policy.has_cancelled_previous_policy",
                operator: "eq",
                value: true,
              },
            ],
          },
          visibleWhen: {
            all: [
              {
                fieldKey: "previous_policy.has_cancelled_previous_policy",
                operator: "eq",
                value: true,
              },
            ],
          },
          helperText: "Your policy number with the previous insurer",
        },
      ],
    },
    {
      key: "dependants",
      title: "Your Dependants",
      description: "Add dependants you would like to cover",
      type: "repeater",
      itemLabel: "Dependant",
      maxItems: 29,
      visibleWhen: {
        any: [
          {
            fieldKey: "setup_plan.cover_plan",
            operator: "eq",
            value: "myself_and_dependants",
          },
          {
            fieldKey: "setup_plan.cover_plan",
            operator: "eq",
            value: "dependants_only",
          },
        ],
      },
      fields: [
        { key: "id_number", label: "Namibian ID number", type: "text", required: true },
        { key: "first_name", label: "First Name", type: "text", required: true },
        { key: "surname", label: "Surname", type: "text", required: true },
        {
          key: "category_all",
          label: "Category",
          type: "dropdown",
          required: true,
          visibleWhen: {
            all: [
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
          optionsCategory: "dependant_category_full",
        },
        {
          key: "category_restricted",
          label: "Category",
          type: "dropdown",
          required: true,
          visibleWhen: {
            all: [
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "dependants_only",
              },
            ],
          },
          optionsCategory: "dependant_category_restricted",
        },
        {
          key: "relationship_to_you",
          label: "Relationship to you",
          type: "dropdown",
          required: true,
          optionsCategory: "relationship_options",
        },
        {
          key: "date_of_birth",
          label: "Date of birth",
          type: "date",
          required: true,
          helperText: "Required for benefits eligibility",
        },
        {
          key: "gender",
          label: "Gender",
          type: "dropdown",
          required: true,
          optionsCategory: "gender",
          helperText:
            "Required for Nedbank dependant validation (used to populate the relationship list).",
        },
        {
          key: "cover_amount",
          label: "Dependant cover (N$)",
          type: "numeric",
          format: "currency",
          min: 5000,
          max: 100000,
          required: true,
        },
        {
          key: "beneficiary_first_name",
          label: "Domestic Worker's Beneficiary first name",
          type: "text",
          required: false,
          helperText:
            "Provide beneficiary details for this domestic worker. The payout will go to the nominated beneficiary.",
          requiredWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
          visibleWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
        },
        {
          key: "beneficiary_last_name",
          label: "Domestic Worker's Beneficiary surname",
          type: "text",
          required: false,
          requiredWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
          visibleWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
        },
        {
          key: "beneficiary_date_of_birth",
          label: "Domestic Worker's Beneficiary date of birth",
          type: "date",
          required: false,
          helperText: "Beneficiary must be 18 years or older",
          requiredWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
          visibleWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
        },
        {
          key: "beneficiary_relationship",
          label: "Beneficiary Relationship to Domestic Worker",
          type: "dropdown",
          required: false,
          optionsCategory: "beneficiary_relationships",
          requiredWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
          visibleWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
        },
        {
          key: "beneficiary_id_number",
          label: "Domestic Worker's Beneficiary Namibian ID number",
          type: "text",
          required: false,
          requiredWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
          visibleWhen: {
            all: [{ fieldKey: "relationship_to_you", operator: "eq", value: "employee" }],
          },
        },
      ],
    },
    {
      key: "optional_benefits",
      title: "Rider Benefits - Optional to the client",
      description: "Choose optional benefits to add to your policy",
      fields: [
        {
          key: "main_member_benefits_header",
          type: "info",
          label: "Your optional benefits",
          content: "Select which optional benefits you would like for yourself:",
          visibleWhen: {
            any: [
              { fieldKey: "setup_plan.cover_plan", operator: "eq", value: "myself" },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
        },
        {
          key: "main_family_supporter",
          label: "Family supporter benefit",
          type: "boolean",
          required: false,
          helperText:
            "Gives your family a monthly income for a fixed period after you have died to help with everyday expenses. The benefit and premium end when: the policy ends, a valid claim is paid, or you turn 66.",
          visibleWhen: {
            any: [
              { fieldKey: "setup_plan.cover_plan", operator: "eq", value: "myself" },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
        },
        {
          key: "main_family_supporter_amount",
          label: "Monthly support amount",
          type: "dropdown",
          required: true,
          optionsCategory: "family_supporter_amounts",
          helperText: "Choose the monthly income your family will receive",
          visibleWhen: {
            all: [
              {
                fieldKey: "optional_benefits.main_family_supporter",
                operator: "eq",
                value: true,
              },
            ],
          },
        },
        {
          key: "main_family_supporter_period",
          label: "Support period",
          type: "dropdown",
          required: true,
          optionsCategory: "family_supporter_period_options",
          helperText: "Choose how long your family will receive monthly support",
          visibleWhen: {
            all: [
              {
                fieldKey: "optional_benefits.main_family_supporter",
                operator: "eq",
                value: true,
              },
            ],
          },
        },
        {
          key: "main_premium_waiver",
          label: "Waiver of Premium Benefit (WoP)",
          type: "boolean",
          required: false,
          helperText:
            "Pays the premiums of this policy after you have died to give your family continuous cover. The benefit and premium end when: the policy ends, a valid claim is paid, or you turn 66. While this benefit is active, the policy cannot be changed.",
          visibleWhen: {
            any: [
              { fieldKey: "setup_plan.cover_plan", operator: "eq", value: "myself" },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
        },
        {
          key: "main_premium_waiver_period",
          label: "Premium waiver period",
          type: "dropdown",
          required: true,
          optionsCategory: "waiver_period_options",
          helperText: "Choose how long the premiums will be paid after your death",
          visibleWhen: {
            all: [
              {
                fieldKey: "optional_benefits.main_premium_waiver",
                operator: "eq",
                value: true,
              },
            ],
          },
        },
        {
          key: "main_cashback",
          label: "Cashback benefit",
          type: "boolean",
          required: false,
          helperText:
            "Get back 20% of your paid premiums every three years if all premiums are up to date. You can cancel and restart this benefit with 30 days written notice. The benefit and premium end when: the policy ends or a funeral benefit is paid for you.",
          visibleWhen: {
            any: [
              { fieldKey: "setup_plan.cover_plan", operator: "eq", value: "myself" },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
        },
      ],
    },
    {
      key: "review_quote",
      title: "Review your quote",
      description:
        "Confirm policy details and accept terms and conditions",
      fields: [
        {
          key: "policy_name",
          label: "Policy name",
          type: "text",
          readonly: true,
          defaultValue: "MyCover Funeral",
        },
        {
          key: "plan_label",
          label: "Cover plan",
          type: "text",
          readonly: true,
          prefillFrom: "setup_plan.cover_plan",
        },
        {
          key: "self_cover_amount_view",
          label: "Your cover",
          type: "numeric",
          format: "currency",
          readonly: true,
          prefillFrom: "setup_plan.self_cover_amount",
          visibleWhen: {
            any: [
              { fieldKey: "setup_plan.cover_plan", operator: "eq", value: "myself" },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
            ],
          },
        },
        {
          key: "dependants_count_view",
          label: "Dependants covered",
          type: "text",
          readonly: true,
          helperText: "Total number of dependants you've added",
          visibleWhen: {
            any: [
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "myself_and_dependants",
              },
              {
                fieldKey: "setup_plan.cover_plan",
                operator: "eq",
                value: "dependants_only",
              },
            ],
          },
        },
        { key: "digital_discount", label: "Digital discount", type: "text", readonly: true, defaultValue: "5%" },
        { key: "client_discount", label: "Nedbank client discount", type: "text", readonly: true, defaultValue: "5%" },
        { key: "total_premium", label: "Total premium", type: "numeric", format: "currency", readonly: true },
        {
          key: "accept_tcs",
          label:
            "Can the client afford the quoted premiums and you have explained the various benefits",
          type: "boolean",
          required: true,
        },
      ],
    },
    {
      key: "payment",
      title: "Debit order details",
      description: "Banking details for debit order",
      fields: [
        { key: "account_holder", label: "Account Holder Name", type: "text", required: true },
        {
          key: "source_of_funds",
          label: "Source of Funds/Income",
          type: "text",
          required: true,
          prefillFromKyc: "employment.source_of_funds",
        },
        {
          key: "bank",
          label: "Bank Name",
          type: "dropdown",
          optionsCategory: "bank_name",
          required: true,
        },
        {
          key: "branch",
          label: "Branch Name",
          type: "dropdown",
          optionsCategory: "bank_branch",
          dependsOn: "payment.bank",
          required: true,
          helperText: "Select your bank first to see available branches",
        },
        { key: "account_number", label: "Account Number", type: "text", required: true },
        {
          key: "account_type",
          label: "Account Type",
          type: "dropdown",
          optionsCategory: "account_types",
          required: true,
        },
        {
          key: "deduction_date",
          label: "Preferred Deduction Date",
          type: "dropdown",
          optionsCategory: "deduction_dates",
          required: true,
        },
      ],
    },
    {
      key: "beneficiary",
      title: "Nominate your beneficiary",
      description:
        "The payout will go to your nominated beneficiary on death. Beneficiaries must be 18 years and older.",
      fields: [
        {
          key: "beneficiary_first_name",
          label: "Beneficiary first name",
          type: "text",
          required: false,
          requiredWhen: {
            any: [
              {
                fieldKey: "optional_benefits.main_premium_waiver",
                operator: "eq",
                value: true,
              },
            ],
          },
          helperText: "Required if you selected the Premium Waiver benefit.",
        },
        {
          key: "beneficiary_last_name",
          label: "Beneficiary surname",
          type: "text",
          required: false,
          requiredWhen: {
            any: [
              {
                fieldKey: "optional_benefits.main_premium_waiver",
                operator: "eq",
                value: true,
              },
            ],
          },
          helperText: "Required if you selected the Premium Waiver benefit.",
        },
        {
          key: "beneficiary_date_of_birth",
          label: "Beneficiary date of birth",
          type: "date",
          required: false,
          requiredWhen: {
            any: [
              {
                fieldKey: "optional_benefits.main_premium_waiver",
                operator: "eq",
                value: true,
              },
            ],
          },
          helperText:
            "Required if you selected the Premium Waiver benefit. Beneficiaries must be 18 years and older.",
        },
        {
          key: "beneficiary_relationship",
          label: "Relationship to beneficiary",
          type: "dropdown",
          required: false,
          requiredWhen: {
            any: [
              {
                fieldKey: "optional_benefits.main_premium_waiver",
                operator: "eq",
                value: true,
              },
            ],
          },
          optionsCategory: "beneficiary_relationships",
          helperText: "Required if you selected the Premium Waiver benefit.",
        },
        {
          key: "beneficiary_id_number",
          label: "Beneficiary Namibian ID number",
          type: "text",
          required: false,
          requiredWhen: {
            any: [
              {
                fieldKey: "optional_benefits.main_premium_waiver",
                operator: "eq",
                value: true,
              },
            ],
          },
          validation: {
            pattern: "^[0-9]{11}$",
            message: "ID number must be exactly 11 digits",
          },
          helperText: "Required if you selected the Premium Waiver benefit.",
        },
      ],
    },
  ],
  optionsCategories: {
    relationship_options: [
      { value: "wife", label: "Wife" },
      { value: "husband", label: "Husband" },
      { value: "son", label: "Son" },
      { value: "daughter", label: "Daughter" },
      { value: "mother", label: "Mother" },
      { value: "father", label: "Father" },
      { value: "grandmother", label: "Grandmother" },
      { value: "grandfather", label: "Grandfather" },
      { value: "employee", label: "Employee (Domestic worker)" },
      { value: "other", label: "Other" },
    ],
    cover_plan_options: [
      { value: "myself", label: "Myself" },
      { value: "myself_and_dependants", label: "Myself and my dependants" },
      { value: "dependants_only", label: "Just my dependants" },
    ],
    dependant_category_full: [
      { value: "spouse", label: "Spouse" },
      { value: "parent", label: "Parent" },
      { value: "grandparent", label: "Grandparent" },
      { value: "domestic_worker", label: "Domestic worker" },
      { value: "child", label: "Child" },
      { value: "sibling", label: "Sibling" },
      { value: "extended", label: "Extended family" },
      { value: "other", label: "Other" },
    ],
    dependant_category_restricted: [
      { value: "spouse", label: "Spouse" },
      { value: "parent", label: "Parent" },
      { value: "grandparent", label: "Grandparent" },
      { value: "domestic_worker", label: "Domestic worker" },
    ],
    premium_payment_options: [
      {
        value: "nedbank_debit_order",
        label: "N$450.00 pm – 10% off for Nedbank debit order",
      },
      { value: "other_bank_debit_order", label: "N$500.00 pm – 5% off for other banks" },
    ],
    waiver_period_options: [
      { value: "12_months", label: "12 months" },
      { value: "24_months", label: "24 months" },
    ],
    family_supporter_amounts: [
      { value: "500", label: "N$500 per month" },
      { value: "1000", label: "N$1,000 per month" },
      { value: "1500", label: "N$1,500 per month" },
      { value: "2000", label: "N$2,000 per month" },
      { value: "2500", label: "N$2,500 per month" },
    ],
    family_supporter_period_options: [
      { value: "3_months", label: "3 months" },
      { value: "6_months", label: "6 months" },
      { value: "9_months", label: "9 months" },
      { value: "12_months", label: "12 months" },
    ],
    beneficiary_relationships: [
      { value: "mother", label: "Mother" },
      { value: "father", label: "Father" },
      { value: "spouse", label: "Spouse" },
      { value: "brother", label: "Brother" },
      { value: "sister", label: "Sister" },
      { value: "aunt", label: "Aunt" },
      { value: "uncle", label: "Uncle" },
      { value: "niece", label: "Niece" },
      { value: "nephew", label: "Nephew" },
      { value: "cousin", label: "Cousin" },
      { value: "son", label: "Son" },
      { value: "daughter", label: "Daughter" },
      { value: "grandson", label: "Grandson" },
      { value: "granddaughter", label: "Granddaughter" },
      { value: "child", label: "Child" },
      { value: "other", label: "Other" },
    ],
    gender: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
      { value: "other", label: "Other" },
    ],
    bank_name: [
      { value: "nedbank", label: "Nedbank" },
      { value: "fnb", label: "FNB" },
      { value: "standard_bank", label: "Standard Bank" },
      { value: "absa", label: "Absa" },
      { value: "bank_windhoek", label: "Bank Windhoek" },
      { value: "other", label: "Other" },
    ],
    bank_branch: {
      nedbank: [
        { value: "windhoek", label: "Windhoek" },
        { value: "swakopmund", label: "Swakopmund" },
        { value: "walvis_bay", label: "Walvis Bay" },
      ],
      fnb: [
        { value: "windhoek", label: "Windhoek" },
        { value: "oshakati", label: "Oshakati" },
      ],
      standard_bank: [
        { value: "windhoek", label: "Windhoek" },
        { value: "keetmanshoop", label: "Keetmanshoop" },
      ],
      absa: [
        { value: "windhoek", label: "Windhoek" },
        { value: "walvis_bay", label: "Walvis Bay" },
      ],
      bank_windhoek: [
        { value: "windhoek", label: "Windhoek" },
        { value: "grootfontein", label: "Grootfontein" },
      ],
      other: [{ value: "other", label: "Other" }],
    },
    account_types: [
      { value: "cheque", label: "Cheque" },
      { value: "savings", label: "Savings" },
      { value: "transmission", label: "Transmission" },
    ],
    deduction_dates: [
      { value: "1", label: "1" },
      { value: "15", label: "15" },
      { value: "25", label: "25" },
    ],
  },
  documents: [
    { key: "banking_details", label: "Proof of banking details", required: true },
    {
      key: "previous_policy_proof",
      label: "Proof of previous policy (cancellation letter/certificate)",
      required: false,
      requiredWhen: {
        any: [
          { fieldKey: "previous_policy.has_cancelled_previous_policy", operator: "eq", value: true },
        ],
      },
      helperText: "Required if you have cancelled a previous funeral policy",
    },
  ],
  termsAndConditions: {
    key: "terms_and_conditions",
    title: "Terms and Conditions",
    content:
      "By proceeding I acknowledge this is an application for funeral cover with NNLA/Nedbank Insurance Namibia. Cover amounts, waiting periods, exclusions, and premium rules apply as per the policy. I authorise monthly debit orders on the selected date once the policy is accepted. Personal information will be processed for policy administration in line with Namibian law. The underwriter is Nedgroup Life Assurance Company Ltd.",
    agreementText: "I confirm that I have read and agree to the Terms and Conditions",
  },
};

