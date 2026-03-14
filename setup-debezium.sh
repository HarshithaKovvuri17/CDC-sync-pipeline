#!/bin/bash

echo "Registering Debezium PostgreSQL connector..."

curl -X POST http://localhost:8083/connectors \
-H "Content-Type: application/json" \
-d '{
  "name": "products-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",

    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "user",
    "database.password": "password",
    "database.dbname": "products_db",

    "database.server.name": "pg-server",

    "plugin.name": "pgoutput",

    "table.include.list": "public.products",

    "decimal.handling.mode": "double",

    "slot.name": "products_slot",

    "publication.autocreate.mode": "filtered",

    "tombstones.on.delete": "true",

    "topic.prefix": "pg-server"
  }
}'