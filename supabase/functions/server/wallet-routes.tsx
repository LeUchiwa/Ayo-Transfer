import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

function getUserId(c: any): string {
  const userId = c.get("userId");
  if (!userId) throw new Error("userId missing from context");
  return userId;
}

async function getUserWallet(userId: string) {
  const wallet = await kv.get(`wallet:${userId}`);
  if (!wallet) {
    const defaultWallet = {
      userId,
      balance: 0,
      totalSent: 0,
      totalReceived: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      countSent: 0,
      countReceived: 0,
      countDeposits: 0,
      countWithdrawals: 0,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`wallet:${userId}`, defaultWallet);
    return defaultWallet;
  }
  return wallet;
}

async function getUserTransactions(userId: string) {
  const transactions = await kv.get(`transactions:${userId}`);
  return transactions || [];
}

// GET wallet
app.get("/wallet", async (c) => {
  try {
    const userId = getUserId(c);
    const wallet = await getUserWallet(userId);
    const transactions = await getUserTransactions(userId);
    return c.json({
      stats: wallet,
      transactions: transactions.slice(0, 20),
    });
  } catch (error) {
    console.log("Error fetching wallet data:", error);
    return c.json({ error: "Failed to fetch wallet data", details: error.message }, 500);
  }
});

// POST deposit
app.post("/wallet/deposit", async (c) => {
  try {
    const userId = getUserId(c);
    const body = await c.req.json();
    const { amount, method, methodIcon, phone, reference, fee } = body;

    if (!amount || !method || !reference) {
      return c.json({ error: "Missing required fields: amount, method, reference" }, 400);
    }
    if (amount <= 0) {
      return c.json({ error: "Amount must be greater than 0" }, 400);
    }

    const transaction = {
      id: reference,
      type: "deposit",
      amount: Number(amount),
      fee: Number(fee) || 0,
      status: "pending",
      reference,
      method,
      methodIcon,
      phone,
      createdAt: new Date().toISOString(),
    };

    const transactions = await getUserTransactions(userId);
    transactions.unshift(transaction);
    await kv.set(`transactions:${userId}`, transactions);

    return c.json({ success: true, transaction });
  } catch (error) {
    console.log("Error creating deposit:", error);
    return c.json({ error: "Failed to create deposit", details: error.message }, 500);
  }
});

// POST withdraw
app.post("/wallet/withdraw", async (c) => {
  try {
    const userId = getUserId(c);
    const body = await c.req.json();
    const { amount, method, methodIcon, phone, reference, fee } = body;

    if (!amount || !method || !reference) {
      return c.json({ error: "Missing required fields: amount, method, reference" }, 400);
    }

    const wallet = await getUserWallet(userId);
    const totalAmount = Number(amount) + (Number(fee) || 0);

    if (wallet.balance < totalAmount) {
      return c.json({
        error: "Insufficient balance",
        message: `Solde insuffisant. Disponible: ${wallet.balance} FCFA, Requis: ${totalAmount} FCFA`,
      }, 400);
    }

    const transaction = {
      id: reference,
      type: "withdrawal",
      amount: Number(amount),
      fee: Number(fee) || 0,
      status: "pending",
      reference,
      method,
      methodIcon,
      phone,
      createdAt: new Date().toISOString(),
    };

    const transactions = await getUserTransactions(userId);
    transactions.unshift(transaction);
    await kv.set(`transactions:${userId}`, transactions);

    return c.json({ success: true, transaction });
  } catch (error) {
    console.log("Error creating withdrawal:", error);
    return c.json({ error: "Failed to create withdrawal", details: error.message }, 500);
  }
});

// POST transfer
app.post("/wallet/transfer", async (c) => {
  try {
    const userId = getUserId(c);
    const body = await c.req.json();
    const { amount, recipient, method, methodIcon, phone, reference, fee } = body;

    if (!amount || !recipient || !method || !reference) {
      return c.json({ error: "Missing required fields: amount, recipient, method, reference" }, 400);
    }

    const wallet = await getUserWallet(userId);
    const totalAmount = Number(amount) + (Number(fee) || 0);

    if (wallet.balance < totalAmount) {
      return c.json({
        error: "Insufficient balance",
        message: `Solde insuffisant. Disponible: ${wallet.balance} FCFA, Requis: ${totalAmount} FCFA`,
      }, 400);
    }

    const transaction = {
      id: reference,
      type: "transfer_sent",
      amount: Number(amount),
      fee: Number(fee) || 0,
      status: "pending",
      reference,
      method,
      methodIcon,
      recipient,
      phone,
      createdAt: new Date().toISOString(),
    };

    const transactions = await getUserTransactions(userId);
    transactions.unshift(transaction);
    await kv.set(`transactions:${userId}`, transactions);

    return c.json({ success: true, transaction });
  } catch (error) {
    console.log("Error creating transfer:", error);
    return c.json({ error: "Failed to create transfer", details: error.message }, 500);
  }
});

// POST confirm
app.post("/wallet/confirm/:transactionId", async (c) => {
  try {
    const userId = getUserId(c);
    const transactionId = c.req.param("transactionId");

    const wallet = await getUserWallet(userId);
    const transactions = await getUserTransactions(userId);

    const transactionIndex = transactions.findIndex((t: any) => t.id === transactionId);
    if (transactionIndex === -1) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    const transaction = transactions[transactionIndex];

    if (transaction.status !== "pending") {
      return c.json({
        error: "Transaction already processed",
        message: `Cette transaction est déjà en statut "${transaction.status}"`,
      }, 400);
    }

    transaction.status = "completed";
    transaction.completedAt = new Date().toISOString();
    transactions[transactionIndex] = transaction;

    if (transaction.type === "deposit") {
      wallet.balance += transaction.amount;
      wallet.totalDeposits += transaction.amount;
      wallet.countDeposits += 1;
      wallet.totalReceived += transaction.amount;
    } else if (transaction.type === "withdrawal") {
      wallet.balance -= transaction.amount + transaction.fee;
      wallet.totalWithdrawals += transaction.amount + transaction.fee;
      wallet.countWithdrawals += 1;
    } else if (transaction.type === "transfer_sent") {
      wallet.balance -= transaction.amount + transaction.fee;
      wallet.totalSent += transaction.amount;
      wallet.countSent += 1;
    }

    wallet.updatedAt = new Date().toISOString();

    await kv.set(`wallet:${userId}`, wallet);
    await kv.set(`transactions:${userId}`, transactions);

    return c.json({ success: true, wallet, transaction });
  } catch (error) {
    console.log("Error confirming transaction:", error);
    return c.json({ error: "Failed to confirm transaction", details: error.message }, 500);
  }
});

// POST check-balance
app.post("/wallet/check-balance", async (c) => {
  try {
    const userId = getUserId(c);
    const body = await c.req.json();
    const { amount, fee } = body;

    if (!amount) {
      return c.json({ error: "Missing required field: amount" }, 400);
    }

    const wallet = await getUserWallet(userId);
    const totalAmount = Number(amount) + (Number(fee) || 0);
    const hasSufficientBalance = wallet.balance >= totalAmount;

    return c.json({
      hasSufficientBalance,
      balance: wallet.balance,
      required: totalAmount,
      shortfall: hasSufficientBalance ? 0 : totalAmount - wallet.balance,
    });
  } catch (error) {
    console.log("Error checking balance:", error);
    return c.json({ error: "Failed to check balance", details: error.message }, 500);
  }
});

export default app;