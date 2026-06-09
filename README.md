# Backend Engineering Solutions

This repository contains solutions for a backend engineering challenge focused on microservices, algorithms, system design, scalability, and performance optimization.

## Project Structure

```text
.
├── logging_middleware/
├── vehicle_scheduling/
├── priority_inbox/git
└── notification_system_design.md
```

## Components

### 1. Logging Middleware

A centralized logging middleware for HTTP services that provides:

* Request and response logging
* Unique request tracking
* Structured JSON logs
* Error monitoring support
* Performance measurement

### 2. Vehicle Maintenance Scheduler

A scheduling service that:

* Fetches depot and vehicle maintenance data from protected APIs
* Calculates optimal maintenance plans within mechanic-hour constraints
* Maximizes operational impact score
* Uses Dynamic Programming (0/1 Knapsack) for optimization
* Generates results for multiple depots

### 3. Notification Platform Design

The notification platform includes:

* REST API design and contracts
* Real-time notification architecture
* Database schema design
* Query optimization strategies
* Scalability considerations
* Caching and performance improvements
* Reliable bulk notification delivery
* Priority inbox design

### 4. Priority Inbox

Implementation of a ranking system that:

* Prioritizes unread notifications
* Uses notification type weights
* Considers recency in ranking
* Maintains Top-N notifications efficiently
* Supports continuous notification ingestion

## Technologies

* Node.js
* Express.js
* JavaScript
* REST APIs
* Dynamic Programming
* SQL Database Design
* Caching Strategies
* WebSocket / Server-Sent Events
* Message Queue Concepts

## Screenshots

The repository includes screenshots demonstrating:

* API requests and responses
* Response times
* Algorithm outputs
* Priority notification ranking results

## Design Goals

* Scalability
* Reliability
* Maintainability
* Performance Optimization
* Production-Ready Architecture

## Notes

All solutions are organized into separate modules with clear folder structures, documentation, and output evidence where applicable.
