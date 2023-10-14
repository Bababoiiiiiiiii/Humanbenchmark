import aiohttp
import asyncio
import json
import random
import string

async def generate_credentials(session):
    with open("creds.json", "r") as cf:
        creds = json.loads(cf.read())

    if not creds["username"] or not creds["password"]:
        print("No Credentials, generating account...")

        creds["username"] = "".join(random.choices(string.ascii_letters, k=8))
        creds["password"] = "".join(random.choices(string.ascii_letters + string.digits, k=16))

        async with session.post("https://humanbenchmark.com/api/v4/users", json={
            "email": creds["username"] + "@yahoo.com",
            "username": creds["username"],
            "password": creds["password"]
        }) as response:
            
            if response.status == 200:
                print(f"Successfully created account: {creds['username']}:{creds['password']}\nEmail host is yahoo.com :D")
            else:
                exit(f"{response.status} on signup")
    else:
        async with session.post("https://humanbenchmark.com/api/v4/session", json={
            "username": creds["username"],
            "password": creds["password"]
        }) as response:
            
            if response.status == 200:
                print(f"Successfully logged in as {creds['username']}:{creds['password']}")
            else:
                exit(f"{response.status} on login")


async def run_tests(session, val):
    tests = ["sequence", "chimp", "memory", "number-memory", "verbal-memory", "typing", "aim", "reactiontime"]
    async with asyncio.TaskGroup() as tg:
        for t in tests:
            for _ in range(5):    
                tg.create_task(session.post("https://humanbenchmark.com/api/v4/scores", json={
                    "score": val,
                    "testId": t
                }))
                

async def main(val):
    async with aiohttp.ClientSession() as session:
        await generate_credentials(session)
        await run_tests(session, val)

if __name__ == "__main__":
    val = int(input("Score to achieve?: "))
    asyncio.run(main(val))