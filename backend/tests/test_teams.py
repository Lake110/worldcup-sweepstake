def test_get_teams(client):
    res = client.get("/api/teams/")
    assert res.status_code == 200

def test_teams_have_required_fields(client):
    res = client.get("/api/teams/")
    teams = res.json()
    if len(teams) > 0:
        team = teams[0]
        assert "name" in team
        assert "code" in team
        assert "flag_emoji" in team
        assert "confederation" in team
        assert "fifa_ranking" in team

def test_teams_ordered_by_ranking(client):
    res = client.get("/api/teams/")
    teams = res.json()
    if len(teams) > 1:
        rankings = [t["fifa_ranking"] for t in teams]
        assert rankings == sorted(rankings)

def test_get_groups(client):
    res = client.get("/api/groups/")
    assert res.status_code == 200

def test_groups_have_members(client):
    res = client.get("/api/groups/")
    groups = res.json()
    if len(groups) > 0:
        group = groups[0]
        assert "name" in group
        assert "members" in group