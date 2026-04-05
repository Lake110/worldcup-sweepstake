import uuid

def unique_email():
    return f"user_{uuid.uuid4().hex[:8]}@example.com"

def register_and_login(client):
    email = unique_email()
    client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Test User"
    })
    res = client.post("/api/auth/login", json={
        "email": email,
        "password": "password123"
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_create_sweepstake(client):
    headers = register_and_login(client)
    res = client.post("/api/sweepstakes/", json={
        "name": "Test Sweepstake",
        "max_participants": 4,
        "teams_per_person": 2,
        "scoring_method": "total"
    }, headers=headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Test Sweepstake"
    assert "invite_code" in res.json()
    assert res.json()["is_locked"] == False

def test_create_sweepstake_requires_auth(client):
    res = client.post("/api/sweepstakes/", json={
        "name": "No Auth",
        "max_participants": 4,
        "teams_per_person": 2,
        "scoring_method": "total"
    })
    assert res.status_code == 401

def test_list_sweepstakes(client):
    headers = register_and_login(client)
    client.post("/api/sweepstakes/", json={
        "name": "List Test",
        "max_participants": 4,
        "teams_per_person": 2,
        "scoring_method": "total"
    }, headers=headers)
    res = client.get("/api/sweepstakes/", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1

def test_join_sweepstake(client):
    owner_headers = register_and_login(client)
    create_res = client.post("/api/sweepstakes/", json={
        "name": "Join Test",
        "max_participants": 4,
        "teams_per_person": 2,
        "scoring_method": "total"
    }, headers=owner_headers)
    invite_code = create_res.json()["invite_code"]

    joiner_headers = register_and_login(client)
    join_res = client.post(f"/api/sweepstakes/join/{invite_code}", headers=joiner_headers)
    assert join_res.status_code == 200

def test_cannot_join_twice(client):
    headers = register_and_login(client)
    create_res = client.post("/api/sweepstakes/", json={
        "name": "Double Join Test",
        "max_participants": 4,
        "teams_per_person": 2,
        "scoring_method": "total"
    }, headers=headers)
    invite_code = create_res.json()["invite_code"]
    res = client.post(f"/api/sweepstakes/join/{invite_code}", headers=headers)
    assert res.status_code == 400

def test_run_draw(client):
    headers = register_and_login(client)
    create_res = client.post("/api/sweepstakes/", json={
        "name": "Draw Test",
        "max_participants": 4,
        "teams_per_person": 2,
        "scoring_method": "total"
    }, headers=headers)
    sweepstake_id = create_res.json()["id"]
    draw_res = client.post(f"/api/sweepstakes/{sweepstake_id}/draw", headers=headers)
    assert draw_res.status_code == 200
    participants = draw_res.json()
    assert len(participants) == 1
    assert len(participants[0]["assignments"]) == 2

def test_only_owner_can_draw(client):
    owner_headers = register_and_login(client)
    create_res = client.post("/api/sweepstakes/", json={
        "name": "Owner Draw Test",
        "max_participants": 4,
        "teams_per_person": 2,
        "scoring_method": "total"
    }, headers=owner_headers)
    sweepstake_id = create_res.json()["id"]

    other_headers = register_and_login(client)
    res = client.post(f"/api/sweepstakes/{sweepstake_id}/draw", headers=other_headers)
    assert res.status_code == 403
