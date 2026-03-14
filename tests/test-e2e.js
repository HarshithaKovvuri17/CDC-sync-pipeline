import assert from "assert/strict";

const WRITE_URL = "http://127.0.0.1:8080/api/products";
const READ_URL = "http://127.0.0.1:8081/api/products";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
    console.log("=== Starting E2E Tests ===");

    try {
        // 1. Create a Product
        console.log("1. Creating a new product in Write Service...");
        const createRes = await fetch(WRITE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Test Laptop",
                price: 999.99,
                category: "Electronics",
                stock: 10,
            }),
        });
        const createdProduct = await createRes.json();
        assert.strictEqual(createRes.status, 201, "Expected 201 Created");
        assert(createdProduct.id, "Product should have an ID");
        console.log(`✅ Created Product ID: ${createdProduct.id}`);

        // Wait for Kafka sync
        console.log("Waiting for Kafka to sync to MongoDB...");
        await sleep(3000);

        // 2. Search Product in Read Service
        console.log("2. Searching for product in Read Service...");
        const searchRes = await fetch(`${READ_URL}/search?query=Test+Laptop`);
        const searchData = await searchRes.json();
        assert.strictEqual(searchRes.status, 200);
        const foundProduct = searchData.find(p => p.id === createdProduct.id);
        assert(foundProduct, "Should find the newly created product in search results");
        assert.strictEqual(foundProduct.name, "Test Laptop");
        assert.strictEqual(foundProduct.price, 999.99);
        console.log("✅ Product correctly synced to Read Service");

        // 3. Update Product
        console.log("3. Updating the product...");
        const updateRes = await fetch(`${WRITE_URL}/${createdProduct.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Test Laptop Pro",
                price: 1299.99,
                category: "Electronics",
                stock: 5,
            }),
        });
        assert.strictEqual(updateRes.status, 200, "Expected 200 OK");
        console.log("✅ Product updated in Write Service");

        // Wait for Kafka sync
        console.log("Waiting for Kafka to sync to MongoDB...");
        await sleep(3000);

        // 4. Verify Update in Read Service
        const checkUpdateRes = await fetch(`${READ_URL}/category/Electronics`);
        const checkUpdateData = await checkUpdateRes.json();
        const updatedModel = checkUpdateData.find((p) => p.id === createdProduct.id);
        assert(updatedModel, "Product should exist in category query");
        assert.strictEqual(updatedModel.name, "Test Laptop Pro");
        assert.strictEqual(updatedModel.price, 1299.99);
        console.log("✅ Update correctly synced to Read Service");

        // 5. Soft Delete Product
        console.log("5. Soft deleting the product...");
        const deleteRes = await fetch(`${WRITE_URL}/${createdProduct.id}`, {
            method: "DELETE",
        });
        assert.strictEqual(deleteRes.status, 204, "Expected 204 No Content");
        console.log("✅ Product soft deleted in Write Service");

        // Wait for Kafka sync
        console.log("Waiting for Kafka to sync to MongoDB...");
        await sleep(3000);

        // 6. Verify Deletion in Read Service
        const checkDeleteRes = await fetch(`${READ_URL}/search?query=Test+Laptop+Pro`);
        const checkDeleteData = await checkDeleteRes.json();
        const deletedFound = checkDeleteData.find(p => p.id === createdProduct.id);
        assert(!deletedFound, "Product should not be found (soft deleted = hidden)");
        console.log("✅ Soft delete correctly hidden in Read Service");

        // 7. Test Sync Status Endpoint
        console.log("7. Checking Sync Status...");
        const syncRes = await fetch("http://127.0.0.1:8081/api/sync/status");
        const syncData = await syncRes.json();
        assert(syncData.totalEventsProcessed > 0, "Consumer should have processed events");
        assert(syncData.consumerLag >= 0, "Consumer lag should be a non-negative number");
        console.log("✅ Sync Status:", syncData);

        console.log("\n🎉 ALL TESTS PASSED! 🎉");
    } catch (err) {
        console.error("\n❌ TESTS FAILED!");
        console.error(err);
        process.exit(1);
    }
}

runTests();
