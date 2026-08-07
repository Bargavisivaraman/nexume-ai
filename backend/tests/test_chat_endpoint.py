"""Tests for POST /chat/ — the Nexus career chatbot."""


def test_general_question_replies_without_job_lookup(api_client, fake_llm, fake_supabase):
    fake_llm("Lead with quantified impact on every bullet.")
    db = fake_supabase(tables={"jobs": [{"title": "should not be fetched"}]})

    resp = api_client.post("/chat/", json={
        "messages": [{"role": "user", "content": "How do I improve my resume summary?"}],
    })

    assert resp.status_code == 200
    body = resp.json()
    assert "quantified impact" in body["reply"]
    assert body["jobs"] == []
    assert db.calls == []  # no intent → no job lookup


def test_job_question_attaches_matching_listings(api_client, fake_llm, fake_supabase):
    fake_llm("Here are some roles worth a look.")
    fake_supabase(tables={"jobs": [
        {"title": "Python Developer", "company": "Acme", "location": "Austin, TX", "url": "https://x/1"},
    ]})

    resp = api_client.post("/chat/", json={
        "messages": [{"role": "user", "content": "find me python developer jobs"}],
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["jobs"] and body["jobs"][0]["title"] == "Python Developer"
