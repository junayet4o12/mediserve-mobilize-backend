const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()

const port = process.env.PORT || 3000
app.use(cors())
app.use(express.json())
app.get('/', (req, res) => {
    res.send('Hello World!')
})
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fbi4wg4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const mediserveMobilize = client.db('mediserveMobilize')
        const campsCollection = mediserveMobilize.collection('medicalCamps')
        const feedbackCollection = mediserveMobilize.collection('feedback')
        const upcommingCampCollection = mediserveMobilize.collection('upcommingCamp')
        const usersCollection = mediserveMobilize.collection('users');
        const registrationCampCollection = mediserveMobilize.collection('registrationCamp');

        // jwt related api start
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
        })
        // jwt related api end
        // middlware start
        const verifyToken = (req, res, next) => {
            console.log('inside vefified token', req.headers.authorization);
            if (!req?.headers?.authorization) {
                return res.status(401).send({ message: 'unauthrised' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthrised' })
                }
                req.decoded = decoded
                next()
            })
        }
        // middlware end

        // usersCollection start
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const axistingUser = await usersCollection.findOne(query);
            if (axistingUser) {
                return res.send({ message: ' use already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })
        // usersCollection end 
        // campsCollection start 
        app.get('/camps', async (req, res) => {
            const result = await campsCollection.find().toArray();
            res.send(result)
        })
        app.put('/camps/:campId', async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const updatedCamp = {
                $inc:
                {
                    participators: 1
                },
            }
            const result = await campsCollection.updateOne(query, updatedCamp)
            res.send(result)
        })
        app.get('/camps/:campId', async (req, res) => {
            const campId = req?.params?.campId;
            const query = { _id: new ObjectId(campId) }
            const camp = await campsCollection.findOne(query)
            res.send(camp)
        })
        app.get('/campsamount', async (req, res) => {
            const count = await campsCollection.estimatedDocumentCount()
            res.send({ count })
        })
        app.get('/popularcamp', async (req, res) => {
            const result = await campsCollection.find().sort({ participators: -1 }).limit(6).toArray()
            res.send(result)
        })

        // campsCollection end
        // upcommingcampsCollection start
        app.get('/upcommingcamps', async (req, res) => {
            const result = await upcommingCampCollection.find().toArray();
            res.send(result)
        })
        // upcommingcampsCollection end

        // feedback start
        app.get('/feedback', async (req, res) => {
            const result = await feedbackCollection.find().sort({ time: -1 }).toArray();
            res.send(result)
        })
        // feedback end

        // registrationCampCollection start
        app.get('/registrationcamps', async (req, res) => {
            const result = await registrationCampCollection.find().toArray()
            res.send(result)
        })
        app.post('/registrationcamps', async (req, res) => {
            const registrationCamp = req.body;
            const result = await registrationCampCollection.insertOne(registrationCamp)
            res.send(result)
        })
        // registrationCampCollection end
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir);
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})