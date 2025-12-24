# Quick Setup: Local Network Testing

## Step 1: Start Local Blockchain

Open terminal:
```bash
cd /home/theone/Desktop/coinflip
npx hardhat node
```

**Leave this running!** You'll see 20 accounts with 10,000 ETH each.

## Step 2: Add Localhost to MetaMask

1. Open MetaMask
2. Click network dropdown (top left)
3. Click "Add network manually"
4. Enter:
   - **Network name:** Localhost 8545
   - **New RPC URL:** http://127.0.0.1:8545
   - **Chain ID:** 31337
   - **Currency symbol:** ETH
5. Click "Save"

## Step 3: Switch to Localhost Network

In MetaMask:
- Click network dropdown
- Select "Localhost 8545"

## Step 4: Import Account

1. Click your account icon (top right)
2. "Import account"
3. Paste this private key:
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```
4. **You should now see 10,000 ETH!**

If you see 0 ETH, make sure:
- Hardhat node is running (Step 1)
- You're on "Localhost 8545" network (Step 3)

## Step 5: Deploy Contract to Localhost

In a NEW terminal:
```bash
cd /home/theone/Desktop/coinflip
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy-local.ts --network localhost
```

## Now Test!

Go to http://localhost:3000/play and create games with unlimited ETH!
