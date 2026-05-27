"""Generate tests/fixtures/sample_dump.sql with realistic dummy data."""
from pathlib import Path

NULL = "\\N"

def row(*vals):
    return "\t".join(NULL if v is None else str(v) for v in vals)

lines = []

def section(title):
    lines.append(f"\n-- {title}")

def copy_block(table, cols, rows):
    lines.append(f"COPY public.{table} ({', '.join(cols)}) FROM stdin;")
    for r in rows:
        lines.append(row(*r))
    lines.append("\\.")

lines.append("-- Synthetic Postgres dump for legislink-demo.")
lines.append("-- All personal data is fictional.")
lines.append("SET client_encoding = 'UTF8';")

# ── LEGISLATORS ──────────────────────────────────────────────────────────────
section("LEGISLATORS")
# id, username, legislator_id, district, counties, house, party, legislator_url, photo_url
legislators = [
    # House Republicans
    (1,  "rep.carter.wells",    "HW001", "1",  "Salt Lake",       "H", "R", None, None),
    (2,  "rep.melissa.hunt",    "HH002", "2",  "Utah",            "H", "R", None, None),
    (3,  "rep.brandon.price",   "HP003", "3",  "Davis",           "H", "R", None, None),
    (4,  "rep.sarah.kimball",   "HK004", "4",  "Weber",           "H", "R", None, None),
    (5,  "rep.thomas.reed",     "HR005", "5",  "Washington",      "H", "R", None, None),
    (6,  "rep.olivia.crane",    "HC006", "6",  "Cache",           "H", "R", None, None),
    (7,  "rep.derek.allred",    "HA007", "7",  "Utah",            "H", "R", None, None),
    (8,  "rep.natalie.fox",     "HF008", "8",  "Salt Lake",       "H", "R", None, None),
    (9,  "rep.paul.garrett",    "HG009", "9",  "Box Elder",       "H", "R", None, None),
    (10, "rep.linda.stone",     "HS010", "10", "Utah",            "H", "R", None, None),
    (11, "rep.marcus.bishop",   "HB011", "11", "Salt Lake",       "H", "R", None, None),
    (12, "rep.claire.walton",   "HW012", "12", "Davis",           "H", "R", None, None),
    # House Democrats
    (13, "rep.jordan.smith",    "HS013", "Demo-1", "Demo County", "H", "D", None, None),
    (14, "rep.aisha.banks",     "HB014", "14", "Salt Lake",       "H", "D", None, None),
    (15, "rep.miguel.reyes",    "HR015", "15", "Salt Lake",       "H", "D", None, None),
    # Senate Republicans
    (16, "sen.william.cross",   "SC016", "1",  "Utah",            "S", "R", None, None),
    (17, "sen.patricia.hale",   "SH017", "2",  "Salt Lake",       "S", "R", None, None),
    (18, "sen.robert.finch",    "SF018", "3",  "Davis, Weber",    "S", "R", None, None),
    (19, "sen.carol.dunn",      "SD019", "4",  "Washington",      "S", "R", None, None),
    (20, "sen.gerald.marsh",    "SM020", "5",  "Cache, Box Elder","S", "R", None, None),
    # Senate Democrats
    (21, "sen.diana.webb",      "SW021", "6",  "Salt Lake",       "S", "D", None, None),
    (22, "sen.kevin.norton",    "SN022", "7",  "Salt Lake",       "S", "D", None, None),
]
copy_block("legislator",
    ["id","username","legislator_id","district","counties","house","party","legislator_url","photo_url"],
    legislators)

# ── COMMITTEES ───────────────────────────────────────────────────────────────
section("COMMITTEES")
# id, committee_id, description, link
committees = [
    (1,  "HBUS", "House Business & Labor Committee",             None),
    (2,  "HEDU", "House Education Committee",                    None),
    (3,  "HJUD", "House Judiciary Committee",                    None),
    (4,  "HREV", "House Revenue & Taxation Committee",           None),
    (5,  "HTRS", "House Transportation Committee",               None),
    (6,  "SBUS", "Senate Business & Labor Committee",            None),
    (7,  "SEDU", "Senate Education Committee",                   None),
    (8,  "SJUD", "Senate Judiciary Committee",                   None),
    (9,  "SREV", "Senate Revenue & Taxation Committee",          None),
    (10, "STRS", "Senate Transportation Committee",              None),
    (11, "HRUL", "House Rules Committee",                        None),
    (12, "SRUL", "Senate Rules Committee",                       None),
    (13, "H3RD", "House Third Reading Calendar",                 None),
    (14, "S3RD", "Senate Third Reading Calendar",                None),
]
copy_block("committee", ["id","committee_id","description","link"], committees)

# ── COMMITTEE MEMBERSHIPS ─────────────────────────────────────────────────────
section("COMMITTEE MEMBERSHIPS")
# id, legislator_id, committee_id, role
memberships = [
    # House Business & Labor
    (1,  "HW001", "HBUS", "Chair"),
    (2,  "HH002", "HBUS", "Vice Chair"),
    (3,  "HP003", "HBUS", "Member"),
    (4,  "HK004", "HBUS", "Member"),
    (5,  "HS013", "HBUS", "Member"),
    # House Education
    (6,  "HR005", "HEDU", "Chair"),
    (7,  "HC006", "HEDU", "Vice Chair"),
    (8,  "HA007", "HEDU", "Member"),
    (9,  "HB014", "HEDU", "Member"),
    # House Judiciary
    (10, "HF008", "HJUD", "Chair"),
    (11, "HG009", "HJUD", "Member"),
    (12, "HR015", "HJUD", "Member"),
    # House Revenue & Taxation
    (13, "HS010", "HREV", "Chair"),
    (14, "HB011", "HREV", "Member"),
    (15, "HW012", "HREV", "Member"),
    # Senate Business & Labor
    (16, "SC016", "SBUS", "Chair"),
    (17, "SH017", "SBUS", "Member"),
    (18, "SW021", "SBUS", "Member"),
    # Senate Education
    (19, "SF018", "SEDU", "Chair"),
    (20, "SD019", "SEDU", "Member"),
    # Senate Judiciary
    (21, "SM020", "SJUD", "Chair"),
    (22, "SN022", "SJUD", "Member"),
    # Senate Revenue & Taxation
    (23, "SH017", "SREV", "Chair"),
    (24, "SC016", "SREV", "Member"),
    # House Rules
    (25, "HW001", "HRUL", "Chair"),
    (26, "HS010", "HRUL", "Vice Chair"),
    (27, "HH002", "HRUL", "Member"),
    (28, "HP003", "HRUL", "Member"),
    (29, "HF008", "HRUL", "Member"),
    # Senate Rules
    (30, "SC016", "SRUL", "Chair"),
    (31, "SH017", "SRUL", "Vice Chair"),
    (32, "SF018", "SRUL", "Member"),
    (33, "SD019", "SRUL", "Member"),
]
copy_block("committee_membership",
    ["id","legislator_id","committee_id","role"], memberships)

# ── COMMITTEE MEETINGS ────────────────────────────────────────────────────────
section("COMMITTEE MEETINGS")
# id, committee_id, meeting_time, agenda_url, meeting_place, bill_ids, updated_at
meetings = [
    # Past committee hearings (February general session)
    (1,  "HBUS", "2026-02-10 09:00:00", None, "Room 30 State Capitol",   '["HB0001","HB0002","HB0005"]',          "2026-02-08 12:00:00"),
    (2,  "HEDU", "2026-02-11 08:00:00", None, "Room 215 State Capitol",  '["HB0142","HB0007"]',                   "2026-02-09 12:00:00"),
    (3,  "HJUD", "2026-02-12 14:00:00", None, "Room 450 State Capitol",  '["HB0003","HB0009"]',                   "2026-02-10 12:00:00"),
    (4,  "HREV", "2026-02-13 10:00:00", None, "Room 30 State Capitol",   '["HB0006","HB0010","HB0011"]',          "2026-02-11 12:00:00"),
    (5,  "SEDU", "2026-02-17 09:00:00", None, "Room 115 State Capitol",  '["HB0220","SB0009"]',                   "2026-02-15 12:00:00"),
    (6,  "SBUS", "2026-02-18 14:00:00", None, "Room 215 State Capitol",  '["HB0001","SB0005"]',                   "2026-02-16 12:00:00"),
    (7,  "SJUD", "2026-02-19 10:00:00", None, "Room 450 State Capitol",  '["SB0006","SB0007"]',                   "2026-02-17 12:00:00"),
    # Upcoming meetings (special session, June 2026)
    (8,  "HBUS", "2026-06-03 09:00:00", None, "Room 30 State Capitol",   '["HB0008","HB0014"]',                   "2026-06-01 12:00:00"),
    (9,  "HRUL", "2026-06-03 08:00:00", None, "Speaker's Suite",         '["HB0001","HB0005","HB0015"]',          "2026-06-01 12:00:00"),
    (10, "SRUL", "2026-06-03 09:30:00", None, "President's Suite",       '["SB0001","SB0004","SB0006"]',          "2026-06-01 12:00:00"),
    (11, "H3RD", "2026-06-04 09:00:00", None, "House Chamber",           '["HB0013","HB0014","HB0015","HB0220"]', "2026-06-02 12:00:00"),
    (12, "S3RD", "2026-06-04 14:00:00", None, "Senate Chamber",          '["SB0001","SB0002","SB0004","SB0006"]', "2026-06-02 12:00:00"),
    (13, "SEDU", "2026-06-04 10:00:00", None, "Room 115 State Capitol",  '["HB0013","SB0009"]',                   "2026-06-02 12:00:00"),
    (14, "SJUD", "2026-06-05 10:00:00", None, "Room 450 State Capitol",  '["SB0003","SB0007"]',                   "2026-06-03 12:00:00"),
]
copy_block("committee_meeting",
    ["id","committee_id","meeting_time","agenda_url","meeting_place","bill_ids","updated_at"], meetings)

# ── BILLS ─────────────────────────────────────────────────────────────────────
section("BILLS")
# id, bill_number, title, short_description, detailed_description,
# version, location, sponsor, floor_sponsor, subjects,
# house_comm_vote, house_comm_vote_id, house_floor_vote, house_floor_vote_id,
# senate_comm_vote, senate_comm_vote_id, senate_floor_vote, senate_floor_vote_id,
# link, updated_at

bills = [
    # ── SEED BILLS (always required) ──────────────────────────────────────────
    (1,  "HB0001", "Occupational Licensing Reform Act",
     "Streamlines occupational licensing requirements across regulated professions.",
     "Amends provisions related to occupational licensing to reduce barriers to entry, "
     "require agencies to justify license requirements, and create a reciprocity pathway "
     "for out-of-state license holders. Applies to professions regulated under Title 58.",
     "3", "Senate Revenue & Taxation", "Rep. Carter Wells", "Sen. Patricia Hale",
     "Occupational Licensing; Business Regulation; Workforce",
     "10-2", "HV-001", "47-26", "HF-001",
     "6-1", "SV-001", None, None,
     None, "2026-02-18 15:30:00"),

    (2,  "HB0142", "Education Funding Stabilization Act",
     "Creates a reserve fund mechanism to stabilize K-12 education funding during downturns.",
     "Establishes the Education Stabilization Reserve Fund within the Uniform School Fund. "
     "Requires the Legislature to contribute 2% of WPU appropriations annually until the "
     "fund reaches a 5% reserve cap. Allows draws when General Fund revenue drops more than "
     "3% year over year. Requires actuarial review every two years.",
     "2", "House Education", "Rep. Melissa Hunt", "Rep. Brandon Price",
     "Education; School Finance; Budget Reserves",
     "8-3", "HV-142a", None, None,
     None, None, None, None,
     None, "2026-02-12 09:00:00"),

    (3,  "HB0220", "Broadband Infrastructure Expansion Act",
     "Funds last-mile broadband deployment to unserved rural communities.",
     "Appropriates $45M from the Infrastructure Investment Fund to the Governor's Office "
     "of Economic Opportunity for grants to internet service providers that extend "
     "broadband service to census-designated places with fewer than 2,500 residents and "
     "no existing provider offering 25/3 Mbps service. Establishes competitive grant "
     "criteria weighted toward affordability commitments.",
     "1", "House Transportation", "Rep. Thomas Reed", "Sen. Gerald Marsh",
     "Telecommunications; Rural Development; Infrastructure",
     "9-2", "HV-220a", "49-24", "HF-220",
     "5-2", "SV-220", "23-6", "SF-220",
     None, "2026-02-22 16:00:00"),

    (4,  "SB0003", "Criminal Justice Diversion Program Amendments",
     "Expands pre-trial diversion eligibility for non-violent offenses.",
     "Modifies the pre-trial diversion statute to extend eligibility to first-time "
     "offenders charged with class B and class C misdemeanors. Requires participating "
     "counties to submit annual outcome reports to the Utah Sentencing Commission. "
     "Appropriates $3.2M for case management services.",
     "2", "Senate Judiciary", "Sen. Diana Webb", "Rep. Jordan Smith",
     "Criminal Justice; Pre-Trial Diversion; Sentencing",
     None, None, None, None,
     "7-2", "SV-003a", None, None,
     None, "2026-02-14 11:00:00"),

    (5,  "SB0042", "Small Business Tax Credit Expansion",
     "Extends the post-pandemic small business tax credit through 2028.",
     "Amends the small business machinery and equipment tax credit under Section 59-7 "
     "to increase the credit rate from 6% to 9% and extend the sunset date to December "
     "31, 2028. Adds a refundability provision for businesses with fewer than 10 "
     "employees. Estimated revenue impact: -$18M over three years.",
     "1", "Senate Revenue & Taxation", "Sen. William Cross", "Rep. Sarah Kimball",
     "Taxation; Small Business; Tax Credits",
     None, None, None, None,
     "8-1", "SV-042a", "25-4", "SF-042",
     None, "2026-02-20 14:00:00"),

    # ── ADDITIONAL HOUSE BILLS ────────────────────────────────────────────────
    (6,  "HB0002", "Child Care Access and Affordability Act",
     "Increases subsidy eligibility thresholds and creates employer tax incentives for on-site child care.",
     "Raises the income ceiling for the Child Care Assistance Program from 85% to 100% "
     "of the state median income. Creates a new employer tax credit of up to $15,000 for "
     "businesses that establish or subsidize on-site child care facilities. Appropriates "
     "$22M from the General Fund.",
     "2", "House Business & Labor", "Rep. Natalie Fox", "Sen. Diana Webb",
     "Child Care; Workforce; Tax Credits",
     "9-1", "HV-002a", "51-22", "HF-002",
     None, None, None, None,
     None, "2026-02-16 10:00:00"),

    (7,  "HB0003", "Public Lands Water Rights Protection Act",
     "Clarifies state water rights on federal public lands within Utah.",
     "Asserts state authority to manage water rights on Bureau of Land Management and "
     "National Forest Service lands. Directs the Division of Water Rights to file "
     "adjudication claims on behalf of the State for unappropriated flows on federal "
     "land. Requires coordination with the Utah Congressional delegation.",
     "1", "House Judiciary", "Rep. Carter Wells", "Sen. Robert Finch",
     "Water Rights; Public Lands; Federal Relations",
     "7-4", "HV-003a", None, None,
     None, None, None, None,
     None, "2026-02-10 09:00:00"),

    (8,  "HB0004", "Medicaid Dental Benefit Expansion",
     "Adds comprehensive dental coverage to the adult Medicaid benefit.",
     "Requires the Department of Health and Human Services to submit a State Plan "
     "Amendment to CMS to add adult dental services as a covered Medicaid benefit. "
     "Includes preventive, restorative, and emergency extractions. Appropriates $8.5M "
     "in state matching funds to draw down federal FMAP dollars.",
     "1", "House Business & Labor", "Rep. Aisha Banks", "Sen. Diana Webb",
     "Medicaid; Dental; Healthcare Access",
     "8-2", "HV-004a", "45-28", "HF-004",
     None, None, None, None,
     None, "2026-02-18 13:00:00"),

    (9,  "HB0005", "Juvenile Expungement Simplification Act",
     "Automates expungement of certain juvenile records upon reaching age 21.",
     "Requires the Juvenile Court to automatically seal qualifying records without a "
     "petition when the subject turns 21 and has no subsequent felony convictions. "
     "Qualifying offenses exclude violent felonies and sex offenses. Saves an estimated "
     "3,200 petitions annually.",
     "2", "House Judiciary", "Rep. Miguel Reyes", "Sen. Kevin Norton",
     "Juvenile Justice; Expungement; Courts",
     "10-1", "HV-005a", "58-15", "HF-005",
     "7-2", "SV-005", None, None,
     None, "2026-02-21 11:00:00"),

    (10, "HB0006", "Property Tax Transparency Act",
     "Requires plain-language property tax notice and online comparison tool.",
     "Mandates that county assessors send a supplemental plain-language notice explaining "
     "the certified tax rate, truth-in-taxation trigger, and how to appeal. Requires the "
     "State Tax Commission to maintain a public web portal comparing effective tax rates "
     "across counties and cities.",
     "1", "House Revenue & Taxation", "Rep. Linda Stone", "Sen. Patricia Hale",
     "Property Tax; Transparency; Local Government",
     "9-2", "HV-006a", None, None,
     None, None, None, None,
     None, "2026-02-11 15:00:00"),

    (11, "HB0007", "School Meals Universal Provision Act",
     "Provides free breakfast and lunch to all public school students regardless of income.",
     "Appropriates $61M from the Uniform School Fund to cover breakfast and lunch "
     "reimbursements at the federal free meal rate for all K-12 public school students. "
     "Eliminates the application process for free and reduced-price meals. Requires the "
     "State Board of Education to report on participation rates annually.",
     "1", "House Education", "Rep. Aisha Banks", "Sen. Kevin Norton",
     "Education; School Nutrition; Child Welfare",
     "7-4", "HV-007a", None, None,
     None, None, None, None,
     None, "2026-02-09 09:00:00"),

    (12, "HB0008", "Digital Asset Regulatory Clarity Act",
     "Establishes a licensing framework for digital asset exchanges and custodians.",
     "Creates a Digital Asset Business License within the Department of Financial "
     "Institutions. Sets capital requirements, cybersecurity standards, and consumer "
     "disclosure mandates for exchanges holding more than $5M in customer assets. "
     "Provides a 24-month transition period for existing operators.",
     "2", "House Business & Labor", "Rep. Marcus Bishop", "Sen. William Cross",
     "Digital Assets; Financial Regulation; Technology",
     "8-3", "HV-008a", "43-30", "HF-008",
     None, None, None, None,
     None, "2026-02-17 14:00:00"),

    (13, "HB0009", "Homelessness Shelter Siting Standards",
     "Preempts local zoning restrictions that prevent emergency shelter siting.",
     "Prohibits municipalities from enforcing zoning ordinances that effectively ban "
     "emergency shelters within their boundaries. Requires each county with more than "
     "50,000 residents to designate at least one district where shelters are a permitted "
     "use. Provides a cause of action for shelter operators denied compliant permits.",
     "1", "House Judiciary", "Rep. Jordan Smith", None,
     "Homelessness; Land Use; Zoning",
     "6-5", "HV-009a", None, None,
     None, None, None, None,
     None, "2026-02-10 11:00:00"),

    (14, "HB0010", "Workforce Housing Density Bonus Act",
     "Grants density bonuses to developers who include affordable units.",
     "Authorizes municipalities to grant up to a 40% density bonus on residential "
     "projects where at least 15% of units are priced at or below 80% AMI. Requires "
     "affordability covenants of at least 30 years. Preempts local ordinances that "
     "prohibit density bonuses otherwise authorized by this act.",
     "2", "House Business & Labor", "Rep. Claire Walton", "Sen. Patricia Hale",
     "Housing; Zoning; Affordable Housing",
     "9-1", "HV-010a", "52-21", "HF-010",
     "6-3", "SV-010", None, None,
     None, "2026-02-20 16:00:00"),

    (15, "HB0011", "Air Quality Emergency Response Act",
     "Expands mandatory action triggers during air quality inversion events.",
     "Lowers the PM2.5 threshold for triggering mandatory action days from 65 to 55 "
     "micrograms. Requires the Division of Air Quality to issue curtailment orders to "
     "registered industrial sources within 4 hours of threshold breach. Adds civil "
     "penalties of up to $10,000 per day for non-compliance.",
     "1", "House Transportation", "Rep. Olivia Crane", "Sen. Diana Webb",
     "Air Quality; Environment; Public Health",
     "8-3", "HV-011a", None, None,
     None, None, None, None,
     None, "2026-02-13 10:00:00"),

    (16, "HB0012", "Firearm Safe Storage Requirements",
     "Requires locking devices or secure storage for unsupervised firearm access.",
     "Requires any person who stores a firearm in a residence where a minor is present "
     "to secure it with a trigger lock or in a locked container when not in the owner's "
     "immediate control. Establishes a class B misdemeanor for first offense. "
     "Provides a tax credit for the purchase of qualifying storage devices.",
     "1", "House Judiciary", "Rep. Aisha Banks", None,
     "Firearms; Child Safety; Criminal Code",
     "6-5", "HV-012a", None, None,
     None, None, None, None,
     None, "2026-02-10 11:00:00"),

    (17, "HB0013", "Teacher Compensation Equity Act",
     "Phases in a minimum starting teacher salary of $55,000 over three years.",
     "Requires each local education agency to pay beginning teachers no less than "
     "$45,000 in FY2027, $50,000 in FY2028, and $55,000 in FY2029. Appropriates "
     "$74M over three years from the Uniform School Fund. The State Board of Education "
     "shall develop a compliance reporting framework.",
     "3", "Senate Education", "Rep. Melissa Hunt", "Sen. Robert Finch",
     "Education; Teacher Compensation; Workforce",
     "10-1", "HV-013a", "53-20", "HF-013",
     "7-2", "SV-013", "26-3", "SF-013",
     None, "2026-02-24 14:00:00"),

    (18, "HB0014", "Data Privacy Protection Act",
     "Establishes consumer rights over personal data held by commercial entities.",
     "Grants Utah residents the right to access, correct, delete, and opt out of the "
     "sale of their personal data. Applies to entities processing data of more than "
     "100,000 consumers or deriving over 50% of revenue from data sales. Enforced by "
     "the Attorney General with civil penalties up to $7,500 per violation.",
     "2", "House Business & Labor", "Rep. Marcus Bishop", "Sen. William Cross",
     "Data Privacy; Technology; Consumer Protection",
     "8-3", "HV-014a", "46-27", "HF-014",
     None, None, None, None,
     None, "2026-02-19 15:00:00"),

    (19, "HB0015", "Foster Care Independent Living Support Act",
     "Extends foster care support services to age 23 and adds a housing stipend.",
     "Amends the Independent Living program to extend eligibility from age 21 to 23 "
     "for foster youth who are enrolled in post-secondary education or vocational "
     "training. Adds a monthly housing stipend of $500. Appropriates $4.1M from the "
     "General Fund.",
     "1", "House Judiciary", "Rep. Jordan Smith", "Sen. Kevin Norton",
     "Foster Care; Youth; Housing",
     "10-0", "HV-015a", "68-5", "HF-015",
     "8-1", "SV-015", None, None,
     None, "2026-02-21 14:00:00"),

    (20, "HB0016", "Solar Net Metering Rate Reform",
     "Restructures net metering compensation to reflect full cost of service.",
     "Directs the Public Service Commission to conduct a cost-of-service study for "
     "rooftop solar within 18 months. Requires any revised net metering tariff to "
     "provide a transition period of at least 5 years for existing installations. "
     "Prohibits retroactive application of rate changes to grandfathered systems.",
     "2", "House Transportation", "Rep. Thomas Reed", "Sen. Carol Dunn",
     "Solar Energy; Net Metering; Utilities",
     "7-4", "HV-016a", None, None,
     None, None, None, None,
     None, "2026-02-14 09:00:00"),

    # ── ADDITIONAL SENATE BILLS ───────────────────────────────────────────────
    (40, "SB0001", "Infrastructure Bank Capitalization Act",
     "Seeds a revolving infrastructure loan fund with $150M in one-time appropriations.",
     "Creates the Utah Infrastructure Revolving Loan Fund within the Governor's Office "
     "of Planning and Budget. Capitalizes the fund with $150M from the Budget Reserve "
     "Account. Authorizes loans to political subdivisions for roads, water, and broadband "
     "projects at rates not exceeding SOFR plus 50 basis points. Requires semiannual "
     "legislative reporting.",
     "2", "Senate Transportation", "Sen. William Cross", "Rep. Carter Wells",
     "Infrastructure; Transportation; Water; Finance",
     None, None, None, None,
     "9-0", "SV-s001a", "28-1", "SF-s001",
     None, "2026-02-23 14:00:00"),

    (41, "SB0002", "Prescription Drug Pricing Transparency Act",
     "Requires pharmacy benefit managers to disclose rebate and spread pricing data.",
     "Mandates that pharmacy benefit managers licensed in Utah report annually to the "
     "Insurance Department the aggregate amount of rebates received from manufacturers, "
     "spread pricing retained, and administrative fees charged to plan sponsors. "
     "Reports are public. Violations subject to license revocation.",
     "1", "Senate Business & Labor", "Sen. Patricia Hale", "Rep. Natalie Fox",
     "Healthcare; Pharmacy; Transparency",
     None, None, None, None,
     "8-1", "SV-s002a", "26-3", "SF-s002",
     None, "2026-02-20 11:00:00"),

    (42, "SB0004", "Rural Hospital Stabilization Fund",
     "Creates a state grant program to offset losses at critical access hospitals.",
     "Establishes the Rural Hospital Stabilization Fund appropriated at $30M biennially. "
     "Grants are available to hospitals designated as Critical Access by CMS that serve "
     "counties with fewer than 20,000 residents. Award criteria include payer mix, "
     "uncompensated care ratio, and service line preservation.",
     "2", "Senate Business & Labor", "Sen. Robert Finch", "Rep. Linda Stone",
     "Healthcare; Rural; Hospitals",
     None, None, None, None,
     "9-0", "SV-s004a", "27-2", "SF-s004",
     None, "2026-02-22 16:00:00"),

    (43, "SB0005", "Affordable Housing Tax Increment Program",
     "Allows municipalities to designate affordable housing reinvestment areas.",
     "Authorizes cities and counties to create Affordable Housing Reinvestment Areas "
     "where 30% of property tax increment is set aside in a dedicated fund for affordable "
     "housing development. Requires a 30-year affordability covenant on assisted units. "
     "Sunsets in 10 years unless reauthorized.",
     "1", "Senate Revenue & Taxation", "Sen. Patricia Hale", "Rep. Claire Walton",
     "Housing; Tax Increment; Local Government",
     None, None, None, None,
     "7-2", "SV-s005a", None, None,
     None, "2026-02-17 10:00:00"),

    (44, "SB0006", "Statewide Mental Health Crisis Response Act",
     "Funds mobile mental health crisis teams as an alternative to law enforcement response.",
     "Appropriates $18M to the Division of Substance Abuse and Mental Health to award "
     "grants for mobile crisis response teams in counties with populations over 50,000. "
     "Teams must include a licensed clinician and a peer support specialist. Requires "
     "data sharing with 911 dispatch and annual outcome reporting.",
     "2", "Senate Judiciary", "Sen. Kevin Norton", "Rep. Miguel Reyes",
     "Mental Health; Crisis Response; Law Enforcement",
     None, None, None, None,
     "8-1", "SV-s006a", "26-3", "SF-s006",
     None, "2026-02-21 09:00:00"),

    (45, "SB0007", "Election Integrity Audit Act",
     "Requires post-election statistical audits of ballot tabulation equipment.",
     "Mandates that each county clerk conduct a risk-limiting audit of at least one "
     "statewide contest after every general election. Establishes a minimum sample size "
     "based on margin of victory. Requires the Lieutenant Governor to publish audit "
     "reports within 30 days of certification.",
     "1", "Senate Judiciary", "Sen. Carol Dunn", "Rep. Thomas Reed",
     "Elections; Audit; Election Integrity",
     None, None, None, None,
     "6-3", "SV-s007a", None, None,
     None, "2026-02-13 14:00:00"),

    (46, "SB0008", "Long-Term Care Insurance Incentive Act",
     "Creates a refundable income tax credit for long-term care insurance premiums.",
     "Provides a refundable income tax credit equal to 25% of qualified long-term care "
     "insurance premiums, capped at $500 per year per taxpayer. Phases out between "
     "$75,000 and $100,000 AGI for single filers. Estimated revenue impact: -$12M "
     "annually at full take-up.",
     "1", "Senate Revenue & Taxation", "Sen. Gerald Marsh", "Rep. Sarah Kimball",
     "Long-Term Care; Insurance; Tax Credits",
     None, None, None, None,
     "8-1", "SV-s008a", "24-5", "SF-s008",
     None, "2026-02-19 11:00:00"),

    (47, "SB0009", "Public School Open Enrollment Expansion Act",
     "Strengthens inter-district open enrollment rights and transportation support.",
     "Requires local education agencies to accept open enrollment applicants up to "
     "90% of classroom capacity. Prohibits denial based on academic records or "
     "discipline history for students below grade 9. Appropriates $6M for "
     "transportation reimbursements to families using open enrollment.",
     "2", "Senate Education", "Sen. Robert Finch", "Rep. Melissa Hunt",
     "Education; Open Enrollment; School Choice",
     None, None, None, None,
     "7-2", "SV-s009a", "25-4", "SF-s009",
     None, "2026-02-22 10:00:00"),

    (48, "SB0010", "Agricultural Water Efficiency Incentive Act",
     "Provides grants and low-interest loans for on-farm irrigation efficiency upgrades.",
     "Establishes the Agricultural Water Efficiency Loan Program within the Division "
     "of Water Resources. Appropriates $20M for loans at 0% interest to agricultural "
     "water users who upgrade to drip, subsurface, or precision sprinkler systems that "
     "reduce consumptive use by at least 15%. Requires a 10-year minimum use restriction.",
     "1", "Senate Transportation", "Sen. Gerald Marsh", "Rep. Thomas Reed",
     "Agriculture; Water Efficiency; Irrigation",
     None, None, None, None,
     "9-0", "SV-s010a", "27-2", "SF-s010",
     None, "2026-02-23 16:00:00"),
]

bill_cols = [
    "id","bill_number","title","short_description","detailed_description",
    "version","location","sponsor","floor_sponsor","subjects",
    "house_comm_vote","house_comm_vote_id","house_floor_vote","house_floor_vote_id",
    "senate_comm_vote","senate_comm_vote_id","senate_floor_vote","senate_floor_vote_id",
    "link","updated_at",
]
copy_block("bill", bill_cols, bills)

# ── BILL VERSIONS ─────────────────────────────────────────────────────────────
section("BILL VERSIONS")
# id, bill_id, version, effective_date, url
bill_versions = [
    (1,  1,  "1", "2026-01-15", None),
    (2,  1,  "2", "2026-02-03", None),
    (3,  1,  "3", "2026-02-16", None),
    (4,  2,  "1", "2026-01-20", None),
    (5,  2,  "2", "2026-02-11", None),
    (6,  3,  "1", "2026-01-22", None),
    (7,  4,  "1", "2026-01-18", None),
    (8,  4,  "2", "2026-02-13", None),
    (9,  5,  "1", "2026-01-25", None),
    (10, 6,  "1", "2026-01-19", None),
    (11, 6,  "2", "2026-02-14", None),
    (12, 8,  "1", "2026-01-28", None),
    (13, 13, "1", "2026-02-04", None),
    (14, 17, "1", "2026-01-16", None),
    (15, 17, "2", "2026-02-07", None),
    (16, 17, "3", "2026-02-19", None),
    (17, 40, "1", "2026-01-27", None),
    (18, 40, "2", "2026-02-17", None),
]
copy_block("bill_version", ["id","bill_id","version","effective_date","url"], bill_versions)

# ── WRITE FILE ────────────────────────────────────────────────────────────────
out = Path("tests/fixtures/sample_dump.sql")
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
print(f"  {len(bills)} bills, {len(legislators)} legislators, "
      f"{len(committees)} committees ({sum(1 for c in committees if c[1] in ('HRUL','SRUL','H3RD','S3RD'))} calendar/rules), "
      f"{len(memberships)} memberships, {len(meetings)} meetings")
