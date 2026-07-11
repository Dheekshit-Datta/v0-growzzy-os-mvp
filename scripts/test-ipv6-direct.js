
const { PrismaClient } = require('@prisma/client');

// Using the resolved IPv6 address directly
const url = "postgresql://postgres:dheekshit.2011@[2406:da1a:6b0:f60a:bd5:3b54:8ae4:505]:5432/postgres?connect_timeout=30";

async function testConnection() {
    console.log("Testing Direct IPv6 Connection...");
    console.log("URL:", url.replace(/:[^:@]+@/, ':****@'));

    const prisma = new PrismaClient({
        datasources: { db: { url } }
    });

    try {
        await prisma.$connect();
        console.log("✅ SUCCESS! Connected via IPv6 direct.");
        const count = await prisma.user.count();
        console.log(`User count: ${count}`);
    } catch (e) {
        console.error("❌ FAILED:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
