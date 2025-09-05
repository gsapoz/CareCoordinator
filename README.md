#CareCoordinator Appointment Scheduler 

##Installation Instructions

In repo directory (/CareCoordinator/) run the following command to setup a virtual environment

```bash
python3 -m venv .venv

Then start it with the command:

```bash
source .venv/bin/activate

From there, run this command to create a .env file in the repo directory:

```bash
touch .env

Open that file, and enter your LLM Key in the source code:

``
OPENAI_API_KEY=sk-....

Once done, run the following command in terminal to spin up the local server and generate the local database file:

```bash
uvicorn server.app:app --reload

With the server up and running, open a new terminal window, and from the repo directory, navigate to the client layer and start the React dev environment with:

```bash
cd client
npm run dev

Now, simply click "Generate Data" and "Run Scheduler" in that sequence to see the Appointment Scheduler at work, or follow the instructions on screen to explore all of its features

