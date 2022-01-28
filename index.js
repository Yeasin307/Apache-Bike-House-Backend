const express = require('express')
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const ObjectId = require('mongodb').ObjectId;
var admin = require("firebase-admin");

const app = express()
const port = process.env.PORT || 5000;

// Middle Ware
app.use(cors());
app.use(express.json());

var serviceAccount = require('./apache-bike-house-firebase-adminsdk-tse11-7520a0a8dc.json');

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

        app.get('/allorders', async (req, res) => {
            const cursor = orderCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
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
