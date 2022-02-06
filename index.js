const express = require('express')
const { MongoClient } = require('mongodb');
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middle Ware
app.use(cors());
app.use(express.json());

admin.initializeApp({
    credential: admin.credential.cert({
        type: process.env.type,
        project_id: process.env.project_id,
        private_key_id: process.env.private_key_id,
        private_key: process.env.private_key,
        client_email: process.env.client_email,
        client_id: process.env.client_id,
        auth_uri: process.env.auth_uri,
        token_uri: process.env.token_uri,
        auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
        client_x509_cert_url: process.env.client_x509_cert_url
    })
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
            const newOrder = req.body;
            const result = await productCollection.insertOne(newOrder);
            res.json(result);
        })

        app.post('/review', async (req, res) => {
            const newOrder = req.body;
            const result = await reviewCollection.insertOne(newOrder);
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
