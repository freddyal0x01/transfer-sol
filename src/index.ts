import * as solanaweb3 from '@solana/web3.js';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function airdropSolIfNeeded(signer: solanaweb3.Keypair, connection: solanaweb3.Connection) {
  const balance = await connection.getBalance(signer.publicKey);
  console.log(`Current balance: ${balance / solanaweb3.LAMPORTS_PER_SOL} SOL`);

    // 1 SOL should be enough for almost anything you wanna do
  if (balance / solanaweb3.LAMPORTS_PER_SOL < 1) {
    // You can only get up to 2 SOL per request 
    console.log('Airdropping 1 SOL');
    const airdropSignature = await connection.requestAirdrop(
      signer.publicKey,
      solanaweb3.LAMPORTS_PER_SOL
    );

    const latestBlockhash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: airdropSignature,
    });

    const newBalance = await connection.getBalance(signer.publicKey);
    console.log('New balance is', newBalance / solanaweb3.LAMPORTS_PER_SOL, 'SOL');
  }
}

async function initializeSenderKeypair(connection: solanaweb3.Connection): Promise<solanaweb3.Keypair> {
  if (!process.env.PRIVATE_KEY) {
    console.log('Generating new keypair... 🗝️');
    const signer = solanaweb3.Keypair.generate();

    console.log('Creating .env file');
    fs.writeFileSync('.env', `PRIVATE_KEY=[${signer.secretKey.toString()}]`);
    
    // When generating a keypair
    await airdropSolIfNeeded(signer, connection);
    
    return signer;
  }

  const secret = JSON.parse(process.env.PRIVATE_KEY ?? '') as number[];
  const secretKey = Uint8Array.from(secret);
  const keypairFromSecret = solanaweb3.Keypair.fromSecretKey(secretKey);
  
  // When creating it from the secret key
  await airdropSolIfNeeded(keypairFromSecret, connection);
  
  return keypairFromSecret;
}

async function getReceiverPubKey(): Promise<solanaweb3.PublicKey> {
  const publicKey = solanaweb3.Keypair.generate().publicKey;
  return publicKey;
}

async function sendSol(connection: solanaweb3.Connection, payer: solanaweb3.Keypair, receiver: solanaweb3.PublicKey, amount: number) {

  const accountInfo = await connection.getAccountInfo(payer.publicKey);

  let sendAmount = amount * 10 ** 9

  let accountAmount = accountInfo?.lamports ?? 0;

  if (sendAmount > accountAmount) {
    throw new Error("Not enough funds")
  }

  const transaction = new solanaweb3.Transaction().add(
    solanaweb3.SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: receiver,
      lamports: sendAmount
    })
  );

  const transactionSignature = await solanaweb3.sendAndConfirmTransaction(connection, transaction, [payer]);

  console.log(`Transaction https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`)
}

async function main() {
  const connection = new solanaweb3.Connection(solanaweb3.clusterApiUrl('devnet'));
  const payer = await initializeSenderKeypair(connection);
  const receiver = await getReceiverPubKey();

  await sendSol(connection, payer, receiver, 0.4);
}

main().then(() => {
  console.log("Finished successfully")
}).catch((error) => {
  console.error(error);
})