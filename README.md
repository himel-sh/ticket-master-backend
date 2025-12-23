# TicketMaster Backend

Backend API server for the TicketMaster ticket booking platform built with Node.js and Express.

## Project Purpose

TicketMaster Backend provides RESTful API endpoints for the ticket booking platform. It handles user authentication, ticket management, order processing, payment integration with Stripe, and comprehensive analytics for different user roles.

## Live URL

[TicketMaster API](https://ticketmaster-backend.vercel.app)

## Key Features

### Authentication & Authorization

- Firebase JWT token verification
- Role-based access control (Customer, Seller, Admin)
- User profile management
- Seller request management

### Ticket Management

- Create, read, update, delete tickets
- Ticket status management (pending, approved, rejected)
- Ticket advertising system (max 6 featured tickets)
- Inventory management with quantity tracking

### Order Management

- Create bookings/orders
- Order status tracking (pending, approved, rejected, paid)
- Customer order history
- Seller order management

### Payment Processing

- Stripe integration for secure payments
- Checkout session creation
- Payment success handling
- Transaction tracking

### Analytics & Statistics

- Seller statistics (revenue, tickets sold, conversion rates)
- Admin platform statistics
- Customer spending analytics
- Revenue tracking by seller

## NPM Packages Used

### Core Dependencies

- **express** (^4.18.2) - Web framework
- **cors** (^2.8.5) - Cross-origin resource sharing
- **dotenv** (^16.0.3) - Environment variable management
- **mongodb** (^6.0.0) - MongoDB driver
- **stripe** (^14.0.0) - Stripe payment processing
- **firebase-admin** (^12.0.0) - Firebase Admin SDK

### Development Tools

- **nodemon** (^3.0.1) - Auto-restart server on file changes

## Installation & Setup

```bash
cd backend
npm install
npm start
```

## Environment Variables

Create a `.env` file in the backend directory:

```
PORT=3000
MONGODB_URI=your_mongodb_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
FB_SERVICE_KEY=your_firebase_service_account_key_base64
CLIENT_DOMAIN=http://localhost:5173
LOCAL_DOMAIN=http://localhost:3000
```

## Project Structure

```
backend/
├── index.js
├── package.json
├── .env
├── .gitignore
└── serviceKeyConverter.js
```

## API Endpoints

### Authentication

- `POST /user` - Save/update user profile
- `GET /user/role` - Get user role

### Tickets

- `GET /tickets` - Get approved tickets (with optional limit)
- `GET /tickets/:id` - Get ticket details
- `POST /tickets` - Create new ticket (Seller only)
- `PATCH /tickets/:id` - Update ticket information
- `DELETE /tickets/:id` - Delete ticket
- `GET /all-tickets` - Get all tickets (Admin only)
- `GET /approved-tickets` - Get approved tickets (Admin only)
- `GET /advertised-tickets` - Get advertised/featured tickets

### Orders

- `POST /orders` - Create booking/order
- `GET /my-orders` - Get customer orders
- `GET /manage-orders/:email` - Get seller orders
- `PATCH /orders/:id` - Update order status
- `DELETE /orders/:id` - Delete order

### Statistics

- `GET /seller-statistics/:email` - Get seller statistics (Seller only)
- `GET /admin-statistics` - Get platform statistics (Admin only)
- `GET /customer-statistics/:email` - Get customer statistics

### Payment

- `POST /create-checkout-session` - Create Stripe checkout session
- `POST /payment-success` - Handle successful payment

### Admin

- `GET /seller-requests` - Get seller approval requests (Admin only)
- `GET /users` - Get all users (Admin only)
- `PATCH /update-role` - Update user role (Admin only)

## Database Collections

### users

- User profiles and authentication data
- Fields: email, displayName, photoURL, role, created_at, last_loggedin

### tickets

- Ticket listings
- Fields: name, from, to, transportType, departureDate, departureTime, price, quantity, perks, image, seller, status, isAdvertised

### orders

- Customer bookings and transactions
- Fields: ticketId, customer, seller, status, quantity, price, transactionId, name, image, description

### sellerRequests

- Seller approval requests
- Fields: email, created_at

## Features in Detail

### Ticket Management

- Sellers can add tickets with detailed information
- Tickets start with "pending" status requiring admin approval
- Once approved, tickets appear on public listing
- Admins can advertise up to 6 tickets for featured display

### Booking System

- Real-time order creation
- Automatic quantity updates after purchase
- Order status tracking throughout lifecycle
- Support for multiple order statuses

### Payment Processing

- Secure Stripe integration
- Automatic order status updates after payment
- Transaction tracking and history
- Support for multiple payment methods

### Statistics & Analytics

- Real-time revenue tracking
- Sales metrics and conversion rates
- Platform-wide analytics
- Revenue breakdown by seller

## Security Features

- Firebase JWT token verification
- Role-based access control
- Environment variable protection
- Secure payment processing with Stripe
- CORS configuration for authorized domains

## Performance Optimizations

- Efficient database queries
- Pagination support for large datasets
- Indexed collections for faster searches
- Caching of frequently accessed data

## Error Handling

- Comprehensive error messages
- Proper HTTP status codes
- Validation of request data
- Transaction rollback on failures

## Deployment

The backend is deployed on Vercel with the following configuration:

- Automatic deployments from GitHub
- Environment variables configured in Vercel dashboard
- MongoDB Atlas for database hosting
- Stripe API keys configured securely

## Testing

To test API endpoints, use tools like:

- Postman
- Thunder Client
- cURL
- REST Client (VS Code extension)

**Made with ❤️ by the Shahriar Hasan Himel**
