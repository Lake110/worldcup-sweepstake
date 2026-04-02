from sqlalchemy.orm import Session
from app.models.team import Team
from app.models.group import Group, GroupMember

TEAMS = [
    # Group A
    {"name": "Mexico",             "code": "MEX", "flag_emoji": "🇲🇽", "confederation": "CONCACAF", "fifa_ranking": 18, "latitude": 23.6345,  "longitude": -102.5528},
    {"name": "South Africa",       "code": "RSA", "flag_emoji": "🇿🇦", "confederation": "CAF",      "fifa_ranking": 37, "latitude": -30.5595, "longitude": 22.9375},
    {"name": "South Korea",        "code": "KOR", "flag_emoji": "🇰🇷", "confederation": "AFC",      "fifa_ranking": 16, "latitude": 35.9078,  "longitude": 127.7669},
    {"name": "Czech Republic",     "code": "CZE", "flag_emoji": "🇨🇿", "confederation": "UEFA",     "fifa_ranking": 39, "latitude": 49.8175,  "longitude": 15.4730},

    # Group B
    {"name": "Canada",             "code": "CAN", "flag_emoji": "🇨🇦", "confederation": "CONCACAF", "fifa_ranking": 30, "latitude": 56.1304,  "longitude": -106.3468},
    {"name": "Bosnia Herzegovina", "code": "BIH", "flag_emoji": "🇧🇦", "confederation": "UEFA",     "fifa_ranking": 42, "latitude": 43.9159,  "longitude": 17.6791},
    {"name": "Qatar",              "code": "QAT", "flag_emoji": "🇶🇦", "confederation": "AFC",      "fifa_ranking": 38, "latitude": 25.3548,  "longitude": 51.1839},
    {"name": "Switzerland",        "code": "SUI", "flag_emoji": "🇨🇭", "confederation": "UEFA",     "fifa_ranking": 22, "latitude": 46.8182,  "longitude": 8.2275},

    # Group C
    {"name": "Brazil",             "code": "BRA", "flag_emoji": "🇧🇷", "confederation": "CONMEBOL", "fifa_ranking": 4,  "latitude": -14.2350, "longitude": -51.9253},
    {"name": "Morocco",            "code": "MAR", "flag_emoji": "🇲🇦", "confederation": "CAF",      "fifa_ranking": 11, "latitude": 31.7917,  "longitude": -7.0926},
    {"name": "Haiti",              "code": "HAI", "flag_emoji": "🇭🇹", "confederation": "CONCACAF", "fifa_ranking": 48, "latitude": 18.9712,  "longitude": -72.2852},
    {"name": "Scotland",           "code": "SCO", "flag_emoji": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "confederation": "UEFA",     "fifa_ranking": 35, "latitude": 56.4907,  "longitude": -4.2026},

    # Group D
    {"name": "USA",                "code": "USA", "flag_emoji": "🇺🇸", "confederation": "CONCACAF", "fifa_ranking": 23, "latitude": 37.0902,  "longitude": -95.7129},
    {"name": "Paraguay",           "code": "PAR", "flag_emoji": "🇵🇾", "confederation": "CONMEBOL", "fifa_ranking": 31, "latitude": -23.4425, "longitude": -58.4438},
    {"name": "Australia",          "code": "AUS", "flag_emoji": "🇦🇺", "confederation": "AFC",      "fifa_ranking": 25, "latitude": -25.2744, "longitude": 133.7751},
    {"name": "Turkey",             "code": "TUR", "flag_emoji": "🇹🇷", "confederation": "UEFA",     "fifa_ranking": 24, "latitude": 38.9637,  "longitude": 35.2433},

    # Group E
    {"name": "Germany",            "code": "GER", "flag_emoji": "🇩🇪", "confederation": "UEFA",     "fifa_ranking": 8,  "latitude": 51.1657,  "longitude": 10.4515},
    {"name": "Curacao",            "code": "CUW", "flag_emoji": "🇨🇼", "confederation": "CONCACAF", "fifa_ranking": 47, "latitude": 12.1696,  "longitude": -68.9900},
    {"name": "Ivory Coast",        "code": "CIV", "flag_emoji": "🇨🇮", "confederation": "CAF",      "fifa_ranking": 20, "latitude": 7.5400,   "longitude": -5.5471},
    {"name": "Ecuador",            "code": "ECU", "flag_emoji": "🇪🇨", "confederation": "CONMEBOL", "fifa_ranking": 17, "latitude": -1.8312,  "longitude": -78.1834},

    # Group F
    {"name": "Netherlands",        "code": "NED", "flag_emoji": "🇳🇱", "confederation": "UEFA",     "fifa_ranking": 5,  "latitude": 52.1326,  "longitude": 5.2913},
    {"name": "Japan",              "code": "JPN", "flag_emoji": "🇯🇵", "confederation": "AFC",      "fifa_ranking": 21, "latitude": 36.2048,  "longitude": 138.2529},
    {"name": "Sweden",             "code": "SWE", "flag_emoji": "🇸🇪", "confederation": "UEFA",     "fifa_ranking": 33, "latitude": 60.1282,  "longitude": 18.6435},
    {"name": "Tunisia",            "code": "TUN", "flag_emoji": "🇹🇳", "confederation": "CAF",      "fifa_ranking": 36, "latitude": 33.8869,  "longitude": 9.5375},

    # Group G
    {"name": "Belgium",            "code": "BEL", "flag_emoji": "🇧🇪", "confederation": "UEFA",     "fifa_ranking": 13, "latitude": 50.5039,  "longitude": 4.4699},
    {"name": "Egypt",              "code": "EGY", "flag_emoji": "🇪🇬", "confederation": "CAF",      "fifa_ranking": 15, "latitude": 26.8206,  "longitude": 30.8025},
    {"name": "Iran",               "code": "IRN", "flag_emoji": "🇮🇷", "confederation": "AFC",      "fifa_ranking": 28, "latitude": 32.4279,  "longitude": 53.6880},
    {"name": "New Zealand",        "code": "NZL", "flag_emoji": "🇳🇿", "confederation": "OFC",      "fifa_ranking": 40, "latitude": -40.9006, "longitude": 174.8860},

    # Group H
    {"name": "Spain",              "code": "ESP", "flag_emoji": "🇪🇸", "confederation": "UEFA",     "fifa_ranking": 1,  "latitude": 40.4637,  "longitude": -3.7492},
    {"name": "Cape Verde",         "code": "CPV", "flag_emoji": "🇨🇻", "confederation": "CAF",      "fifa_ranking": 44, "latitude": 16.5388,  "longitude": -23.0418},
    {"name": "Saudi Arabia",       "code": "KSA", "flag_emoji": "🇸🇦", "confederation": "AFC",      "fifa_ranking": 32, "latitude": 23.8859,  "longitude": 45.0792},
    {"name": "Uruguay",            "code": "URU", "flag_emoji": "🇺🇾", "confederation": "CONMEBOL", "fifa_ranking": 12, "latitude": -32.5228, "longitude": -55.7658},

    # Group I
    {"name": "France",             "code": "FRA", "flag_emoji": "🇫🇷", "confederation": "UEFA",     "fifa_ranking": 3,  "latitude": 46.2276,  "longitude": 2.2137},
    {"name": "Senegal",            "code": "SEN", "flag_emoji": "🇸🇳", "confederation": "CAF",      "fifa_ranking": 14, "latitude": 14.4974,  "longitude": -14.4524},
    {"name": "Iraq",               "code": "IRQ", "flag_emoji": "🇮🇶", "confederation": "AFC",      "fifa_ranking": 46, "latitude": 33.2232,  "longitude": 43.6793},
    {"name": "Norway",             "code": "NOR", "flag_emoji": "🇳🇴", "confederation": "UEFA",     "fifa_ranking": 19, "latitude": 60.4720,  "longitude": 8.4689},

    # Group J
    {"name": "Argentina",          "code": "ARG", "flag_emoji": "🇦🇷", "confederation": "CONMEBOL", "fifa_ranking": 2,  "latitude": -38.4161, "longitude": -63.6167},
    {"name": "Algeria",            "code": "ALG", "flag_emoji": "🇩🇿", "confederation": "CAF",      "fifa_ranking": 27, "latitude": 28.0339,  "longitude": 1.6596},
    {"name": "Austria",            "code": "AUT", "flag_emoji": "🇦🇹", "confederation": "UEFA",     "fifa_ranking": 29, "latitude": 47.5162,  "longitude": 14.5501},
    {"name": "Jordan",             "code": "JOR", "flag_emoji": "🇯🇴", "confederation": "AFC",      "fifa_ranking": 41, "latitude": 30.5852,  "longitude": 36.2384},

    # Group K
    {"name": "Portugal",           "code": "POR", "flag_emoji": "🇵🇹", "confederation": "UEFA",     "fifa_ranking": 7,  "latitude": 39.3999,  "longitude": -8.2245},
    {"name": "DR Congo",           "code": "COD", "flag_emoji": "🇨🇩", "confederation": "CAF",      "fifa_ranking": 43, "latitude": -4.0383,  "longitude": 21.7587},
    {"name": "Uzbekistan",         "code": "UZB", "flag_emoji": "🇺🇿", "confederation": "AFC",      "fifa_ranking": 45, "latitude": 41.3775,  "longitude": 64.5853},
    {"name": "Colombia",           "code": "COL", "flag_emoji": "🇨🇴", "confederation": "CONMEBOL", "fifa_ranking": 9,  "latitude": 4.5709,   "longitude": -74.2973},

    # Group L
    {"name": "England",            "code": "ENG", "flag_emoji": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "confederation": "UEFA",     "fifa_ranking": 6,  "latitude": 52.3555,  "longitude": -1.1743},
    {"name": "Croatia",            "code": "CRO", "flag_emoji": "🇭🇷", "confederation": "UEFA",     "fifa_ranking": 10, "latitude": 45.1000,  "longitude": 15.2000},
    {"name": "Ghana",              "code": "GHA", "flag_emoji": "🇬🇭", "confederation": "CAF",      "fifa_ranking": 26, "latitude": 7.9465,   "longitude": -1.0232},
    {"name": "Panama",             "code": "PAN", "flag_emoji": "🇵🇦", "confederation": "CONCACAF", "fifa_ranking": 34, "latitude": 8.5380,   "longitude": -80.7821},
]

# Official 2026 World Cup groups
GROUPS = {
    "A": ["MEX", "RSA", "KOR", "CZE"],
    "B": ["CAN", "BIH", "QAT", "SUI"],
    "C": ["BRA", "MAR", "HAI", "SCO"],
    "D": ["USA", "PAR", "AUS", "TUR"],
    "E": ["GER", "CUW", "CIV", "ECU"],
    "F": ["NED", "JPN", "SWE", "TUN"],
    "G": ["BEL", "EGY", "IRN", "NZL"],
    "H": ["ESP", "CPV", "KSA", "URU"],
    "I": ["FRA", "SEN", "IRQ", "NOR"],
    "J": ["ARG", "ALG", "AUT", "JOR"],
    "K": ["POR", "COD", "UZB", "COL"],
    "L": ["ENG", "CRO", "GHA", "PAN"],
}

# Tournament info
TOURNAMENT_START = "2026-06-11"
TOURNAMENT_END   = "2026-07-19"
OPENING_MATCH    = "Mexico vs South Africa — Mexico City"


def seed_teams(db: Session) -> None:
    existing = db.query(Team).count()
    if existing > 0:
        print(f"Teams already seeded ({existing} found), skipping.")
        return
    for team_data in TEAMS:
        db.add(Team(**team_data))
    db.commit()
    print(f"Seeded {len(TEAMS)} teams successfully.")


def seed_groups(db: Session) -> None:
    existing = db.query(Group).count()
    if existing > 0:
        print(f"Groups already seeded ({existing} found), skipping.")
        return

    for group_name, team_codes in GROUPS.items():
        group = Group(name=group_name)
        db.add(group)
        db.flush()  # get group.id before committing

        for code in team_codes:
            team = db.query(Team).filter(Team.code == code).first()
            if team:
                db.add(GroupMember(group_id=group.id, team_id=team.id))
            else:
                print(f"Warning: team code {code} not found, skipping.")

    db.commit()
    print(f"Seeded {len(GROUPS)} groups with team assignments.")


def run_seed(db: Session) -> None:
    """Run all seed functions in order."""
    seed_teams(db)
    seed_groups(db)