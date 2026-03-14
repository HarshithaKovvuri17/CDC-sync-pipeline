# 🚀 Real-Time Data Synchronization Pipeline

A **Real-Time Data Synchronization System** built using  
**Debezium, Apache Kafka, PostgreSQL, MongoDB, Node.js, and Docker**.

Whenever a product is **created, updated, or deleted in PostgreSQL**,  
Debezium captures the change and streams it to **Kafka**,  
and the **Read Service automatically updates MongoDB**.

This architecture is widely used in **event-driven systems, microservices, and real-time analytics**.

---

# 📌 Overview

Modern applications often separate **write operations and read operations**.

Example:

📝 PostgreSQL → Used for transactional writes  
🔎 MongoDB → Used for fast read queries

But synchronizing both databases **in real time** is challenging.

This project solves the problem using **Change Data Capture (CDC)**.

Debezium reads the **PostgreSQL WAL (Write Ahead Log)** and streams changes to Kafka.

The **Read Service consumes Kafka events** and updates MongoDB.

---

# 🏗 System Architecture

Write API  
↓  
🐘 PostgreSQL Database  
↓  
🔄 Debezium CDC  
↓  
📡 Apache Kafka  
↓  
⚙ Read Service Consumer  
↓  
🍃 MongoDB Read Model  
↓  
🔎 Search APIs  

---

# 🛠 Technologies Used

| Technology | Purpose |
|-----------|--------|
🐘 PostgreSQL | Primary transactional database |
📡 Apache Kafka | Event streaming platform |
🔄 Debezium | Change Data Capture |
🍃 MongoDB | Read optimized database |
🟢 Node.js | Backend microservices |
🐳 Docker | Containerization |
📦 Docker Compose | Multi-container orchestration |

---

# 📁 Project Structure
```
cdc-sync-pipeline/
│
├── read-service/
│   │
│   ├── src/
│   │   ├── routes/
│   │   │   ├── products.js
│   │   │   └── sync.js
│   │   │
│   │   ├── consumer.js
│   │   ├── mongo.js
│   │   └── server.js
│   │
│   ├── Dockerfile
│   └── package.json
│
├── write-service/
│   │
│   ├── src/
│   │   ├── routes/
│   │   │   └── products.js
│   │   │
│   │   ├── db.js
│   │   └── server.js
│   │
│   ├── Dockerfile
│   └── package.json
│
├── tests/
│
├── .env.example
├── docker-compose.yml
├── schema.sql
├── setup-debezium.sh
└── README.md
```
---

# ⚙ Setup Instructions

## 1️⃣ Clone Repository

git clone (https://github.com/HarshithaKovvuri17/CDC-sync-pipeline.git)

cd cdc-sync-pipeline

---

## 2️⃣ Start All Services

docker compose up -d --build

This will start:

🐘 PostgreSQL  
📡 Kafka  
📡 Zookeeper  
🔄 Debezium Connector  
🍃 MongoDB  
⚙ Write Service  
⚙ Read Service  

---

## 3️⃣ Verify Containers

docker ps

Expected:

postgres  
zookeeper  
kafka  
kafka-connect  
mongo  
write-service  
read-service  

---

# 🔄 Debezium Connector

Check connectors:

http://localhost:8083/connectors

Expected output:

["products-connector"]

Check connector status:

http://localhost:8083/connectors/products-connector/status

---

# 🌐 API Endpoints

## ➕ Create Product

POST

http://localhost:8080/api/products

Body:

{
"name": "Gaming Mouse",
"price": 60,
"category": "Electronics",
"stock": 50
}

---

## ✏ Update Product

PUT

http://localhost:8080/api/products/1

Body:

{
"name": "Gaming Mouse Pro",
"price": 80,
"category": "Electronics",
"stock": 45
}

---

## ❌ Delete Product

DELETE

http://localhost:8080/api/products/1

---

## 🔎 Search Product

GET

http://localhost:8081/api/products/search?query=Mouse

---

## 📂 Filter by Category

GET

http://localhost:8081/api/products/category/Electronics

---

## 📊 Sync Status

GET

http://localhost:8081/api/sync/status

Example response:

{
"consumerLag": 0,
"lastProcessedOffset": 12,
"totalEventsProcessed": 12
}

---

# 🧪 Testing the Pipeline

### Step 1

Create a product using POST API.

---

### Step 2

Verify PostgreSQL

docker exec -it postgres psql -U user -d products_db

SELECT * FROM products;

---

### Step 3

Check Kafka events

docker exec -it kafka bash

kafka-console-consumer \\
--bootstrap-server localhost:9092 \\
--topic pg-server.public.products \\
--from-beginning

---

### Step 4

Verify MongoDB Sync

docker exec -it mongo mongosh

use products_read_db

db.products.find().pretty()

---

### Step 5

Search Product

http://localhost:8081/api/products/search?query=Mouse

---

# 📦 Example MongoDB Document

{
"id": 7,
"name": "Gaming Mouse",
"price": 60,
"category": "Electronics",
"stock": 50
}

---

# ⭐ Benefits of This Architecture

✔ Real-time synchronization  
✔ Event-driven microservices  
✔ Loose coupling between services  
✔ Scalable architecture  
✔ Fast read queries  

---

# 🔮 Future Improvements

📊 Add Prometheus monitoring  
📡 Add Kafka Schema Registry  
🛑 Implement Dead Letter Queue  
🔁 Retry & backoff strategies  
🔎 Distributed tracing  

---

# 👨‍💻 Author

Kovvuri Harshitha
