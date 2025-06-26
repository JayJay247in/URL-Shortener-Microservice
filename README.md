# URL Shortener Microservice

A full-stack JavaScript application that shortens URLs, built with Node.js, Express, and deployed on Netlify as serverless functions.

## Features

- ✅ Shorten long URLs to manageable short URLs
- ✅ Redirect short URLs to original URLs
- ✅ URL validation using DNS lookup
- ✅ Clean, responsive user interface
- ✅ RESTful API endpoints
- ✅ Serverless deployment ready

## API Endpoints

### POST `/api/shorturl`

Create a short URL from a long URL.

**Request Body:**
```json
{
  "url": "https://www.example.com"
}
```

**Response:**
```json
{
  "original_url": "https://www.example.com",
  "short_url": 1
}
```

**Error Response:**
```json
{
  "error": "invalid url"
}
```

### GET `/api/shorturl/:short_url`

Redirect to the original URL using the short URL ID.

**Example:**
```
GET /api/shorturl/1
```

This will redirect to the original URL associated with ID 1.

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd url-shortener-microservice
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp sample.env .env
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Deployment to Netlify

### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Connect to Netlify:**
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Connect your GitHub account
   - Select your repository
   - Build settings should be auto-detected from `netlify.toml`
   - Click "Deploy site"

### Method 2: Manual Deployment

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify:**
   ```bash
   netlify login
   ```

3. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

### Method 3: Drag & Drop

1. Build your project locally:
   ```bash
   npm install
   ```

2. Create a zip file with these files:
   - `netlify/functions/shorturl.js`
   - `netlify.toml`
   - `package.json`
   - `views/index.html` (move to root as `index.html`)
   - `public/style.css`

3. Go to Netlify dashboard and drag & drop the zip file

## File Structure

```
url-shortener-microservice/
├── netlify/
│   └── functions/
│       └── shorturl.js          # Serverless function for API
├── public/
│   └── style.css               # Styles
├── views/
│   └── index.html              # Main HTML page
├── index.js                    # Express server (for local dev)
├── package.json                # Dependencies and scripts
├── netlify.toml               # Netlify configuration
├── sample.env                 # Environment variables template
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## Environment Variables

Create a `.env` file for local development:

```bash
PORT=3000
NODE_ENV=development
```

For Netlify deployment, set environment variables in the Netlify dashboard under Site Settings > Environment Variables.

## Testing

You can test the API endpoints using curl or any HTTP client:

```bash
# Test POST endpoint
curl -X POST https://your-site.netlify.app/api/shorturl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.freecodecamp.org"}'

# Test GET endpoint (redirect)
curl -L https://your-site