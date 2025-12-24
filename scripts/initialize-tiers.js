const hre = require("hardhat");
const { parseEther } = require("ethers");

async function main() {
  // Get network information
  const network = await hre.network.provider.request({ method: "eth_chainId" });
  const chainId = parseInt(network, 16);

  // Determine which contract address to use based on network
  let contractAddress;
  let networkName;

  if (chainId === 11155111) {
    contractAddress = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA;
    networkName = "Ethereum Sepolia";
  } else if (chainId === 80002) {
    contractAddress = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY;
    networkName = "Polygon Amoy";
  } else if (chainId === 80001) {
    contractAddress = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI;
    networkName = "Mumbai (DEPRECATED)";
  } else if (chainId === 137) {
    contractAddress = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON;
    networkName = "Polygon Mainnet";
  } else {
    console.error(`❌ Unsupported network (Chain ID: ${chainId})`);
    process.exit(1);
  }

  if (!contractAddress || contractAddress === "0x...") {
    console.error("❌ Contract address not set in .env.local");
    console.log(`Please deploy the contract first and update the address for ${networkName}`);
    process.exit(1);
  }

  console.log("Network:", networkName);
  console.log("Chain ID:", chainId);
  console.log("Initializing tiers for contract:", contractAddress);

  // Get signer
  const signers = await hre.network.provider.request({
    method: "eth_accounts",
  });

  if (!signers || signers.length === 0) {
    console.error("❌ No accounts found. Make sure PRIVATE_KEY is set in .env.local");
    process.exit(1);
  }

  console.log("Using signer:", signers[0]);

  // Get contract instance
  const CoinFlip = await hre.artifacts.readArtifact("CoinFlip");

  // Detect if we're on testnet or mainnet
  const isTestnet = chainId === 11155111 || chainId === 80002 || chainId === 80001;

  // TESTNET TIERS - 100x smaller for easy testing
  const testnetTiers = [
    { id: 0, amount: "0.00001", usd: 0.05 },   // 0.00001 ETH
    { id: 1, amount: "0.00005", usd: 0.1 },    // 0.00005 ETH
    { id: 2, amount: "0.0001", usd: 0.25 },    // 0.0001 ETH
    { id: 3, amount: "0.0005", usd: 0.5 },     // 0.0005 ETH
    { id: 4, amount: "0.001", usd: 1 },        // 0.001 ETH
  ];

  // PRODUCTION TIERS - Normal amounts for mainnet
  const productionTiers = [
    { id: 0, amount: "0.001", usd: 5 },    // ~$5
    { id: 1, amount: "0.002", usd: 10 },   // ~$10
    { id: 2, amount: "0.005", usd: 25 },   // ~$25
    { id: 3, amount: "0.010", usd: 50 },   // ~$50
    { id: 4, amount: "0.020", usd: 100 },  // ~$100
  ];

  // Select appropriate tiers
  const tiers = isTestnet ? testnetTiers : productionTiers;

  console.log(`\n${isTestnet ? '🧪 TESTNET MODE' : '🚀 PRODUCTION MODE'} - Using ${isTestnet ? 'smaller test' : 'production'} amounts`);

  console.log("\nSetting tier amounts:");
  console.log("======================");

  const currencySymbol = chainId === 137 || chainId === 80002 || chainId === 80001 ? 'POL' : 'ETH';

  const { Interface } = require("ethers");
  const iface = new Interface(CoinFlip.abi);

  for (const tier of tiers) {
    const amount = parseEther(tier.amount);
    console.log(`Tier ${tier.id}: ${tier.amount} ${currencySymbol} (~$${tier.usd})`);

    const data = iface.encodeFunctionData("setTier", [tier.id, amount, true]);

    const tx = await hre.network.provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: signers[0],
        to: contractAddress,
        data: data,
      }],
    });

    console.log(`  ✅ Transaction: ${tx}`);

    // Wait for confirmation
    let receipt = null;
    while (receipt === null) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      receipt = await hre.network.provider.request({
        method: "eth_getTransactionReceipt",
        params: [tx],
      });
    }

    console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);
  }

  console.log("\n✅ All tiers initialized successfully!");
  console.log("\nYou can now test the coinflip application.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
