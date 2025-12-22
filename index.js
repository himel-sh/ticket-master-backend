require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
// middleware
app.use(
  cors({
    origin: [process.env.CLIENT_DOMAIN, process.env.LOCAL_DOMAIN],
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("ticketDB");
    const ticketCollection = db.collection("tickets");
    const ordersCollection = db.collection("orders");
    const usersCollection = db.collection("users");
    const sellerRequestsCollection = db.collection("sellerRequests");

    //role middlewares
    const verifyADMIN = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "admin")
        return res
          .status(403)
          .send({ message: "Admin only Access!", role: user?.role });

      next();
    };

    const verifySELLER = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "seller")
        return res
          .status(403)
          .send({ message: "Seller only Access!", role: user?.role });

      next();
    };

    //Save ticket data in db
    app.post("/tickets", verifyJWT, verifySELLER, async (req, res) => {
      const ticketData = req.body;
      console.log(ticketData);
      const result = await ticketCollection.insertOne(ticketData);
      res.send(result);
    });

    //get ticket data from db
    app.get("/tickets", async (req, res) => {
      const result = await ticketCollection.find().toArray();
      res.send(result);
    });

    //get ticket data from db
    app.get("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ticketCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Payment Endpoints
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: paymentInfo?.ticketName || paymentInfo?.name,
                description: paymentInfo?.description,
                images: [paymentInfo?.image],
              },
              unit_amount:
                (paymentInfo?.price ||
                  paymentInfo?.totalPrice / paymentInfo?.quantity) * 100,
            },
            quantity: paymentInfo?.quantity || 1,
          },
        ],
        customer_email: paymentInfo?.customer?.email,

        mode: "payment",
        metadata: {
          orderId: paymentInfo?.orderId,
          ticketId: paymentInfo?.ticketId,
          customer: paymentInfo?.customer.email,
        },
        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/my-orders`,
      });
      res.send({ url: session.url });
    });

    app.post("/payment-success", async (req, res) => {
      const { sessionId } = req.body;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Handle order payment (from My Orders)
      if (session.metadata.orderId) {
        const order = await ordersCollection.findOne({
          _id: new ObjectId(session.metadata.orderId),
        });

        if (session.status === "complete" && order) {
          // Update order status to paid
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(session.metadata.orderId) },
            { $set: { status: "paid", transactionId: session.payment_intent } }
          );

          // Update ticket quantity
          const ticket = await ticketCollection.findOne({
            _id: new ObjectId(order.ticketId),
          });

          if (ticket) {
            await ticketCollection.updateOne(
              { _id: new ObjectId(order.ticketId) },
              { $inc: { quantity: -order.quantity } }
            );
          }

          return res.send({
            transactionId: session.payment_intent,
            orderId: session.metadata.orderId,
          });
        }
      }

      // Handle direct ticket purchase (from Ticket Details)
      if (session.metadata.ticketId) {
        const ticket = await ticketCollection.findOne({
          _id: new ObjectId(session.metadata.ticketId),
        });
        const order = await ordersCollection.findOne({
          transactionId: session.payment_intent,
        });

        if (session.status === "complete" && ticket && !order) {
          //save order data in db
          const orderInfo = {
            ticketId: session.metadata.ticketId,
            transactionId: session.payment_intent,
            customer: session.metadata.customer,
            status: "paid",
            seller: ticket?.seller,
            name: ticket?.name,
            category: ticket?.category,
            quantity: 1,
            price: session.amount_total / 100,
            description: ticket?.description,
            image: ticket?.image,
          };
          const result = await ordersCollection.insertOne(orderInfo);
          //  update ticket quantity
          await ticketCollection.updateOne(
            { _id: new ObjectId(session.metadata.ticketId) },
            { $inc: { quantity: -1 } }
          );
          return res.send({
            transactionId: session.payment_intent,
            orderId: result.insertedId,
          });
        }
      }

      res.send({
        transactionId: session.payment_intent,
        orderId: null,
      });
    });

    // get all orders for a customer by email
    app.get("/my-orders", verifyJWT, async (req, res) => {
      const result = await ordersCollection
        .find({ customer: req.tokenEmail })
        .toArray();
      res.send(result);
    });
    // get all orders for a seller by email
    app.get(
      "/manage-orders/:email",
      verifyJWT,
      verifySELLER,
      async (req, res) => {
        const email = req.params.email;
        const result = await ordersCollection
          .find({ "seller.email": email })
          .toArray();
        res.send(result);
      }
    );
    // get all tickets for a seller by email
    app.get(
      "/my-inventory/:email",
      verifyJWT,
      verifySELLER,
      async (req, res) => {
        const email = req.params.email;
        const result = await ticketCollection
          .find({ "seller.email": email })
          .toArray();
        res.send(result);
      }
    );

    // Create a new booking/order
    app.post("/orders", async (req, res) => {
      const orderData = req.body;
      try {
        const result = await ordersCollection.insertOne(orderData);
        res.status(201).send(result);
      } catch (error) {
        res.status(400).send({ message: "Failed to create booking", error });
      }
    });

    // Delete order by id
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ordersCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Delete ticket by id
    app.delete("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ticketCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Update ticket by id
    app.patch("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const ticketData = req.body;
      try {
        const result = await ticketCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: ticketData }
        );
        res.send(result);
      } catch (error) {
        res.status(400).send({ message: "Failed to update ticket", error });
      }
    });

    // Update order status by id
    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send(result);
    });

    // save or update a user in db
    app.post("/user", async (req, res) => {
      const userData = req.body;

      userData.created_at = new Date().toISOString();
      userData.last_loggedin = new Date().toISOString();
      userData.role = "customer";

      const query = {
        email: userData.email,
      };

      const alreadyExists = await usersCollection.findOne({
        email: userData.email,
      });
      console.log("User Already Exists--->", !!alreadyExists);
      if (alreadyExists) {
        console.log("updating user info");
        const result = await usersCollection.updateOne(query, {
          $set: { last_loggedin: new Date().toISOString() },
        });
        return res.send(result);
      }

      console.log("saving new user info");
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    // get a users role

    app.get("/user/role", verifyJWT, async (req, res) => {
      const result = await usersCollection.findOne({ email: req.tokenEmail });
      res.send({ role: result?.role });
    });

    // save become-seller request
    app.post("/become-seller", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
      const alreadyExists = await sellerRequestsCollection.findOne({
        email,
      });
      if (alreadyExists)
        return res
          .status(409)
          .send({ message: "Already Requested , please wait for approval" });
      const result = await sellerRequestsCollection.insertOne({ email });
      res.send(result);
    });

    // get all seller requests for admin
    app.get("/seller-requests", verifyJWT, verifyADMIN, async (req, res) => {
      const result = await sellerRequestsCollection.find().toArray();
      res.send(result);
    });
    // get all users requests for admin
    app.get("/users", verifyJWT, verifyADMIN, async (req, res) => {
      const adminEmail = req.tokenEmail;
      const result = await usersCollection
        .find({ email: { $ne: adminEmail } })
        .toArray();
      res.send(result);
    });

    //update a users role
    app.patch("/update-role", verifyJWT, verifyADMIN, async (req, res) => {
      const { email, role } = req.body;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { role } }
      );
      await sellerRequestsCollection.deleteOne({ email });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
