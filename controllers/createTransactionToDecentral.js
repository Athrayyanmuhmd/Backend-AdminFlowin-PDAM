import { ethers } from "ethers";
import { ABI } from "../contracts/abi.js";
const contractAddress = process.env.CONTRACT_ADDRESS_LOCAL;
const contractAbi = ABI.abi; // Use the abi property from the imported ABI object

const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const signer = provider.getSigner();

// Contract
const contract = new ethers.Contract(contractAddress, contractAbi, signer);

// Function to write transaction to blockchain
async function writeTransactionToBlockchain(userId, receiverId, amount, description) {
    try {
        // No need to convert userId and receiverId to BigInt as they are now strings
        // Only convert amount to BigInt
        const amountBN = ethers.toBigInt(amount);

        // Create transaction
        const transaction = await contract.createTransaction(
            userId, // Already a string
            receiverId, // Already a string
            amountBN,
            description
        );

        // Wait for transaction to be mined
        const receipt = await transaction.wait();

        // Return transaction details
        return {
            success: true,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            events: receipt.events,
        };
    } catch (error) {
        console.error("Error writing to blockchain:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

// Function to integrate with incrementUsedWater
export async function createBlockchainTransaction(userId, receiverId, amount, description = "Water Usage Payment") {
    try {
        // Ensure all parameters are present
        if (!userId || !receiverId || !amount) {
            throw new Error("Missing required parameters");
        }

        // Ensure userId and receiverId are strings
        const userIdStr = userId.toString();
        const receiverIdStr = receiverId.toString();

        // Write to blockchain
        const result = await writeTransactionToBlockchain(userIdStr, receiverIdStr, amount, description);

        if (!result.success) {
            throw new Error(`Blockchain transaction failed: ${result.error}`);
        }

        return result;
    } catch (error) {
        console.error("Error in createBlockchainTransaction:", error);
        throw error;
    }
}

// Function to get transactions by user ID from blockchain
export async function getDataFromBlockchainByUserId(userId) {
    try {
        // Ensure userId is a string
        const userIdStr = userId.toString();

        // Call the smart contract method
        const transactions = await contract.getTransactionsByUser(userIdStr);

        // Format the response
        const formattedTransactions = transactions.map((tx) => ({
            userId: tx.userId,
            receiverId: tx.receiverId,
            amount: Number(tx.amount), // Convert BigInt to number
            description: tx.description,
            timestamp: Number(tx.timestamp), // Convert BigInt to number
        }));

        return {
            success: true,
            data: formattedTransactions,
        };
    } catch (error) {
        console.error("Error fetching blockchain data:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}
