const express = require('express')
const { MongoClient } = require('mongodb');
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
require('dotenv').config();
const stripe = require('stripe')(process.env.Stripe_Secret);
const fileUpload = require('express-fileupload');

const app = express();
const port = process.env.PORT || 5000;

// Middle Ware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lcr1a.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(idToken);
            req.decodedUserEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db('Apache-Bike-House');
        const productCollection = database.collection('Products');
        const userCollection = database.collection('Users');
        const orderCollection = database.collection('Orders');
        const reviewCollection = database.collection('Reviews');

        app.get('/explore', async (req, res) => {
            const cursor = productCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
        })

        app.get('/explore/:_id', async (req, res) => {
            const id = req.params._id;
            const query = { _id: ObjectId(id) };
            const user = await productCollection.findOne(query);
            console.log('load user with id:', id);
            res.send(user);
        })

        app.get('/orders', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.decodedUserEmail === email) {
                const query = { email: email }
                const cursor = orderCollection.find(query);
                const orders = await cursor.toArray();
                res.json(orders);
            }
            else {
                res.status(401).json({ Message: 'User Not Authorized' })
            }
        })

        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.json(order);
        })

        app.put('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    payment: payment
                }
            };
            const result = await orderCollection.updateOne(filter, updateDoc);
            res.json(result);
        })

        app.get('/allorders', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (email && req.decodedUserEmail === email) {
                const cursor = orderCollection.find({});
                const orders = await cursor.toArray();
                res.json(orders);
            }
            else {
                res.status(401).json({ Message: 'User Not Admin' })
            }
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.json(result);
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/parchase', async (req, res) => {
            const newOrder = req.body;
            const result = await orderCollection.insertOne(newOrder);
            res.json(result);
        })

        app.post('/product', async (req, res) => {
            const name = req.body.name;
            const feature1 = req.body.feature1;
            const feature2 = req.body.feature2;
            const feature3 = req.body.feature3;
            const price = parseInt(req.body.price);

            const pic = req.files.image;
            const picData = pic.data;
            const encodedPic = picData.toString('base64');
            const imageBuffer = Buffer.from(encodedPic, 'base64');

            const product = {
                name,
                description: {
                    feature1,
                    feature2,
                    feature3
                },
                img: imageBuffer,
                price
            }
            const result = await productCollection.insertOne(product);
            res.json(result);
        })

        app.delete('/deleteproduct/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.json(result);
        })

        app.post('/review', async (req, res) => {
            const name = req.body.name;
            const email = req.body.email;
            const rating = req.body.rating;
            const comment = req.body.comment;

            const pic = req.files.img;
            const picData = pic.data;
            const encodedPic = picData.toString('base64');
            const imageBuffer = Buffer.from(encodedPic, 'base64');

            const review = {
                name,
                email,
                rating,
                comment,
                img: imageBuffer
            }
            const result = await reviewCollection.insertOne(review);
            res.json(result);
        })

        app.get('/reviews', async (req, res) => {
            const cursor = reviewCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
        })

        app.put('/users/admin', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const updateDoc = { $set: { role: 'admin' } };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.json(result);
        })

        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                payment_method_types: ['card']
            });

            res.json({ clientSecret: paymentIntent.client_secret });
        })

        app.delete('/cancelorders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.json(result);
        })

    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Welcome Apache Bike House')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})
