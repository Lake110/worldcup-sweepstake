import uuid

def unique_email():
    return f"user_{uuid.uuid4().hex[:8]}@example.com"

def test_register(client):
    res = client.post("/api/auth/register", json={
        "email": unique_email(),
        "password": "password123",
        "full_name": "New User"
    })
    assert res.status_code == 201
    assert "access_token" in res.json()
    assert "user" in res.json()

def test_register_duplicate_email(client):
    email = unique_email()
    client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "User One"
    })
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "User Two"
    })
    assert res.status_code == 400

def test_login(client):
    email = unique_email()
    client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Login User"
    })
    res = client.post("/api/auth/login", json={
        "email": email,
        "password": "password123"
    })
    assert res.status_code == 200
    assert "access_token" in res.json()

def test_login_wrong_password(client):
    email = unique_email()
    client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Wrong Pass"
    })
    res = client.post("/api/auth/login", json={
        "email": email,
        "password": "wrongpassword"
    })
    assert res.status_code == 401

def test_login_nonexistent_user(client):
    res = client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "password123"
    })
    assert res.status_code == 401