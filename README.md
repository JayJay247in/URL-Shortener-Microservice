# URL Shortener Microservice

A simple microservice for shortening URLs. Users can submit long URLs and receive a shortened version for easy sharing and tracking.

## Features

- Shorten long URLs to compact, shareable links
- Redirect shortened URLs to the original address
- Basic analytics (optional)
- RESTful API

## Technologies Used

- Node.js / Express (or your chosen backend)
- MongoDB / Redis (for storage)
- Docker (optional)

## Getting Started

### Prerequisites

- Node.js & npm
- MongoDB (or your preferred database)

### Installation

```bash
git clone https://github.com/JayJay247in/url-shortener-microservice.git
cd url-shortener-microservice
npm install
```

### Running the Service

```bash
npm start
```

The service will be available at `http://localhost:3000`.

## API Endpoints

- `POST /api/shorten`  
    **Body:** `{ "url": "https://example.com" }`  
    **Response:** `{ "shortUrl": "http://localhost:3000/abc123" }`

- `GET /:shortId`  
    Redirects to the original URL.

## Configuration

Edit `.env` for custom settings (port, database URI, etc.).

## License

MIT

## Author

Ikechukwu Faithful