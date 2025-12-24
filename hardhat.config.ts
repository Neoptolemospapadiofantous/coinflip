import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Register ts-node to handle TypeScript files
import "ts-node/register";

dotenv.config({ path: ".env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts:
        process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.startsWith("0x") && process.env.PRIVATE_KEY.length === 66
          ? [process.env.PRIVATE_KEY]
          : [],
      chainId: 80001,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts:
        process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.startsWith("0x") && process.env.PRIVATE_KEY.length === 66
          ? [process.env.PRIVATE_KEY]
          : [],
      chainId: 80002,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts:
        process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.startsWith("0x") && process.env.PRIVATE_KEY.length === 66
          ? [process.env.PRIVATE_KEY]
          : [],
      chainId: 137,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts:
        process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.startsWith("0x") && process.env.PRIVATE_KEY.length === 66
          ? [process.env.PRIVATE_KEY]
          : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
