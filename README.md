📸 InstaLite — Decentralized Social Media DApp

A lightweight Instagram-style decentralized application built with Solidity, Truffle, Ganache, and a pure HTML/CSS/JavaScript frontend. Users can create profiles, post images, like posts, and send ETH tips to creators.

⚙️ Before You Begin

Make sure you have the following tools installed on your system:

Git

Node.js (v14 or later) and npm

Truffle (for compiling & deploying Solidity contracts)

Ganache CLI (local Ethereum blockchain)

Python 3 (for running a local static HTTP server)

You do not need React, IPFS, or WSL for this project.

1. 📥 Cloning the Repository

Open a terminal and navigate to the folder where you want this project stored.
Then clone the repository:

git clone <your-repo-url>
cd <project-folder>


Inside this project you will find:

contracts          → Solidity smart contract (InstaLite.sol)
migrations         → Truffle deployment scripts
UI                 → index.html, style.css, app-instalite.js
                      *sample images provided for posts
truffle-config.js  → Truffle network/compiler settings

2. 📦 Installing Dependencies

This project uses no React — but Truffle requires Node installed.
Just run:

npm install

3.  Starting a Local Blockchain (Ganache)

Open a terminal on Ubuntu machine 

Install Ganache CLI globally if you haven’t:

npm install -g ganache-cli

Then start Ganache in its own terminal:

ganache-cli 
or
ganache-cli --gasLimit 8000000 


Ganache will:

Launch a local Ethereum testnet

Provide 10 funded accounts

Listen on http://127.0.0.1:8545

Keep this terminal open.
Restarting Ganache resets the chain.

4. 📜 Deploying the Smart Contract

Create a directory called Instalite

enter the Instalite directory

Run the command:

**truffle init**

This will create build, contracts, migrations and other directories required in InstaLite

Open **truffle-config.js** in the project root.

2. Uncomment and add the following **development network** block and adjust the gas settings:

```js
networks: {
  development: {
    host: "127.0.0.1",      // Localhost
    port: 8545,             // Ganache CLI default port
    network_id: "*",        // Match any network ID
    gas: 8000000,           // Gas limit for deployments
    gasPrice: 2000000000    // 2 Gwei
  }

Next, adjust the Solidity compiler version so it matches your contract:

compilers: {
  solc: {
    version: "0.8.0"
  }
}
```js

Save the file

Place the smart contract (**instalite.sol**) in the contracts folder. 
Place the migration script (**1_migrate_instalite.sol**) in the contracts folder. 

Run the commands:

**truffle compile
truffle migrate --reset**

Truffle will:

Compile InstaLite.sol

Deploy it to Ganache

Generate build/contracts/InstaLite.json

Print your **contract address**
*save for future use

6. 🌐 Launching the Front-End Server

From the project root, run:

**python3 -m http.server 8030**

Then visit:

http://127.0.0.1:8030/index.html

-------------------------------------------------------------

To start the DApp ensure:

Ganache is running

Truffle was migrated

Contract address is noted

The server is started from the project root, not from UI/

-------------------------------------------------------------

The page includes:

Account dropdown

“Init Ganache” button

“Load Contract” button

Profile creation

Image posting

Likes + tips

On-page DApp Log console

-------------------------------------------------------------

7. 🎮 Using the InstaLite DApp

🟣 Initialize RPC (Ganache)

Click INIT Ganache
→ The DApp connects to http://127.0.0.1:8545
→ Shows connection logs at the bottom

🔵 Load Contract

Paste your contract address from Truffle

→ Accounts populated to dropdown

🟢 Create Profile

Choose an account

Click Create Profile

Enter username

Pick role:

1 = Basic

2 = Creator

3 = Business
Your profile is stored on-chain in the profiles mapping.

🟡 Create Posts (with Images)

When you upload an image:

The browser converts it to a resized base64 image

Stores it in localStorage

Sends only a tiny image key to the contract

The post appears in the “Recent Posts” feed

❤️ Like Posts

Click 💛 Like under any post → updates like count on-chain.

💰 Tip Creators

Two ways:

“💰 Tip” button under a post

“Leave a Tip 💰” sidebar

Tip amounts are sent in real ETH on Ganache.
