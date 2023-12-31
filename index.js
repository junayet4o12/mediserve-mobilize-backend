const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
        const popularcampsCollection = mediserveMobilize.collection('popularcamps')
        const feedbackCollection = mediserveMobilize.collection('feedback')
        const upcommingCampCollection = mediserveMobilize.collection('upcommingCamp')
        const usersCollection = mediserveMobilize.collection('users');
        const registrationCampCollection = mediserveMobilize.collection('registrationCamp');
        const paymentsCollection = mediserveMobilize.collection('payments');
        const upcomingCampParticipantCollection = mediserveMobilize.collection('upcomingCampParticipantCollection');
        const upcomingCampProfessionalCollection = mediserveMobilize.collection('upcomingCampProfessionalCollection');

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

        const verifyOrganizer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isOrganizer = user?.organizerRole === true
            if (!isOrganizer) {
                return res.status(403).send({ message: "forbidden" })
            }

            next()
        }
        const verifyProfessional = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isProfessional = user?.professionalRole === true
            console.log(isProfessional);
            if (!isProfessional) {
                return res.status(403).send({ message: "forbidden" })
            }

            next()
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
        app.put('/users/:id', verifyToken, async (req, res) => {

            const userinfo = req.body;
            const id = req?.params?.id
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedInfo = {
                $set: {
                    name: userinfo.name,
                    email: userinfo.email,
                    contactNumber: userinfo.contactNumber,
                    age: userinfo.age,
                    country: userinfo.country
                }
            }
            const result = await usersCollection.updateOne(query, updatedInfo, options)
            res.send(result)

        })
        app.put('/profesdionalusers/:id', verifyToken, verifyProfessional, async (req, res) => {

            const userinfo = req.body;
            const id = req?.params?.id
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedInfo = {
                $set: {
                    name: userinfo.name,
                    email: userinfo.email,
                    contactNumber: userinfo.contactNumber,
                    age: userinfo.age,
                    country: userinfo.country,
                    medicalSpeciality: userinfo.medicalSpeciality
                }
            }
            const result = await usersCollection.updateOne(query, updatedInfo, options)
            res.send(result)

        })
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })
        app.get('/users/:email', verifyToken, async (req, res) => {
            const email = req?.params?.email
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            res.send(result)
        })
        app.get('/organizers/:email', verifyToken, verifyOrganizer, async (req, res) => {
            const email = req?.params?.email
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            res.send(result)
        })
        app.get('/professionals/:email', verifyToken, verifyProfessional, async (req, res) => {
            const email = req?.params?.email
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            res.send(result)
        })
        app.get('/user/organizer/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let organizer = false
            if (user) {
                organizer = user?.organizerRole === true
            }
            res.send({ organizer })
        })

        app.get('/user/professional/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let professional = false
            if (user) {
                professional = user?.professionalRole === true
            }
            res.send({ professional })
        })
        // usersCollection end 
        // payement start 
        app.post('/completePayment', verifyToken, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            console.log(amount);
            const payment = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ["card"],
            })
            console.log(payment.client_secret);
            res.send({
                clientSecret: payment.client_secret
            })
        })

        app.get('/payments', async (req, res) => {
            const result = await paymentsCollection.find().toArray()
            res.send(result)
        })
        app.get('/paymentsbyemail/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await paymentsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/payments/:campId', verifyToken, async (req, res) => {
            const id = req.params.campId;
            const paymentdata = req?.body;
            const query = { _id: new ObjectId(id) }
            const updatedCamp = {
                $set:
                {
                    confirmationStatus: 'pending',
                    paymentStatus: 'paid',
                    transactionId: paymentdata?.transactionId
                },
            }
            const payment = await paymentsCollection.insertOne(paymentdata);
            const updateCamp = await registrationCampCollection.updateOne(query, updatedCamp)
            res.send({ payment, updateCamp })
        })
        app.get('/campnameid', async (req, res) => {
            const projection = { _id: 1, campName: 1 };
            const result = await campsCollection.find({}, { projection }).toArray();
            res.send(result)
        })

        app.get('/paidcamp', async (req, res) => {
            const result = await registrationCampCollection.aggregate([
                {
                    $lookup: {
                        from: 'campsCollection',
                        localField: 'campInfo.campName',
                        foreignField: 'campName',
                        as: 'additionalData'
                    }
                },
                // {
                //     $unwind: '$additionalData'
                // },
                // {
                //     $project: {
                //         _id: 1,
                //         email: 1,
                //         price: 1,
                //         date: 1,
                //         registeredCampId: 1,
                //         registeredCampdetails: 1
                //     }
                // }
            ]).toArray();

            res.send(result);
        })

        // payment end 
        // campsCollection start 
        app.get('/camps', async (req, res) => {
            const result = await campsCollection.find().toArray();
            res.send(result)
        })
        app.post('/camps', verifyToken, verifyOrganizer, async (req, res) => {
            const camp = req.body
            const result = await campsCollection.insertOne(camp);
            res.send(result)
        })
        app.post('/campsfromupcoming', verifyToken, verifyOrganizer, async (req, res) => {
            const camp = req.body
            const newCamp = {
                _id: new ObjectId(camp?._id),
                campName: camp?.campName,
                description: camp?.description,
                image: camp?.image,
                campFees: camp?.campFees,
                DateAndTime: camp?.DateAndTime,
                venueLocation: camp?.venueLocation,
                specializedService: camp?.specializedService,
                healthcareExpert: camp?.healthcareExpert,
                targetAudience: camp?.targetAudience,
                participators: camp?.participators,
                professionals: camp?.professionals,
                queryNumber: camp?.queryNumber,
                benefits: camp?.benefits,
                organizerEmail: camp?.organizerEmail,
                interestedParticipators: camp?.interestedParticipators,
            }
            const query = { _id: new ObjectId(camp?._id) }
            const deleteupcoming = await upcommingCampCollection.deleteOne(query)

            const result = await campsCollection.insertOne(newCamp);
            const result2 = await popularcampsCollection.insertOne(newCamp);
            res.send({ result, result2, deleteupcoming })
        })
        app.delete('/delete-camp/:campId', verifyToken, async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const result = await campsCollection.deleteOne(query);
            const result2 = await popularcampsCollection.deleteOne(query);
            res.send(result)
        })
        app.put('/camps/:campId', verifyToken, async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const updatedCamp = {
                $inc:
                {
                    participators: 1
                },
            }
            const result = await campsCollection.updateOne(query, updatedCamp)
            // const result2 = await popularcampsCollection.updateOne(query, updatedCamp)
            res.send(result)
        })
        app.put('/campsdec/:campId', verifyToken, async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const updatedCamp = {
                $inc:
                {
                    participators: -1
                },
            }

            const upcomeresult = await upcommingCampCollection.updateOne(query, updatedCamp)
            const result = await campsCollection.updateOne(query, updatedCamp)
            res.send({ result, upcomeresult })
        })
        app.put('/campedit/:campId', verifyToken, verifyOrganizer, async (req, res) => {
            const data = req.body;
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const registerQuery = { _id: new ObjectId(data?.registerid) }
            const paymentQuery = { transactionId: data?.transactionId }
            const updatedCamp = {
                $inc:
                {
                    participators: -1
                },
            }
            const decParticipants = await campsCollection.updateOne(query, updatedCamp)
            const decupcomeParticipants = await upcommingCampCollection.updateOne(query, updatedCamp)
            const deleteRegister = await registrationCampCollection.deleteOne(registerQuery)
            const deletePayment = await paymentsCollection.deleteOne(paymentQuery)

            res.send({ decParticipants, deleteRegister, deletePayment, decupcomeParticipants })
        })

        app.put('/fullcamp/:campId', verifyToken, async (req, res) => {
            const camp = req.body;

            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedCamp = {
                $set:
                {
                    campName: camp?.campName,
                    campFees: camp?.campFees,
                    description: camp?.description,
                    image: camp?.image,
                    DateAndTime: camp?.DateAndTime,
                    venueLocation: camp?.venueLocation,
                    specializedService: camp?.specializedService,
                    healthcareExpert: camp?.healthcareExpert,
                    targetAudience: camp?.targetAudience,
                    benefits: camp?.benefits
                },
            }
            const result = await campsCollection.updateOne(query, updatedCamp, options)
            res.send(result)
        })
        app.get('/camps/:campId', async (req, res) => {
            const campId = req?.params?.campId;
            const query = { _id: new ObjectId(campId) }
            const camp = await campsCollection.findOne(query)
            res.send(camp)
        })
        app.get('/campsbyorg/:campId', verifyToken, verifyOrganizer, async (req, res) => {
            const campId = req?.params?.campId;
            const query = { _id: new ObjectId(campId) }
            const camp = await campsCollection.findOne(query)
            res.send(camp)
        })
        app.get('/campsbyemail/:email', async (req, res) => {
            const email = req?.params?.email;
            const query = { organizerEmail: email }
            const camps = await campsCollection.find(query).toArray()
            res.send(camps)
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

        // popularcampsCollection start 
        app.get('/popularcamps', async (req, res) => {

            const result = await popularcampsCollection.aggregate([
                {
                    $lookup: {
                        from: 'medicalCamps',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'popularCamps'
                    }
                },
                {
                    $unwind: '$popularCamps'
                },
                {
                    $replaceRoot: { newRoot: '$popularCamps' }
                }
            ]).toArray();
            res.send(result)
        })
        // popularcampsCollection end 



        // upcommingcampsCollection start
        app.get('/upcommingcamps', async (req, res) => {
            const result = await upcommingCampCollection.find().toArray();
            res.send(result)
        })
        app.get('/upcommingcamps/:campId', async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const result = await upcommingCampCollection.findOne(query)
            res.send(result)
        })
        app.put('/updateupcommingcamps/:campId', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.campId;
            const camp = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedCamp = {
                $set:
                {
                    campName: camp?.campName,
                    campFees: camp?.campFees,
                    description: camp?.description,
                    image: camp?.image,
                    DateAndTime: camp?.DateAndTime,
                    venueLocation: camp?.venueLocation,
                    specializedService: camp?.specializedService,
                    healthcareExpert: camp?.healthcareExpert,
                    targetAudience: camp?.targetAudience,
                    benefits: camp?.benefits
                },
            }
            const result = await upcommingCampCollection.updateOne(query, updatedCamp)
            res.send(result)
        })
        app.get('/manageupcommingcamps/:email', async (req, res) => {
            const email = req.params.email;
            const query = { organizerEmail: email }
            const result = await upcommingCampCollection.find(query).toArray()
            res.send(result)
        })
        app.put('/deleteupcoming/:id', async (req, res) => {
            const camp = req?.body
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const query2 = { queryNumber: camp?.queryNumber }
            const result = await upcommingCampCollection.deleteOne(query)
            const result2 = await upcomingCampParticipantCollection.deleteMany(query2)
            const result3 = await upcomingCampProfessionalCollection.deleteMany(query2)
            const result4 = await registrationCampCollection.deleteMany(query2)
            const result5 = await paymentsCollection.deleteMany(query2)
            res.send({ result, result2, result3, result4, result5 })
        })
        app.post('/upcomingcamps', verifyToken, verifyOrganizer, async (req, res) => {
            const campData = req.body;
            const result = await upcommingCampCollection.insertOne(campData);
            res.send(result);
        })
        // upcommingcampsCollection end



        // upcomingCampParticipantCollection start
        app.get('/participantlist', async (req, res) => {
            const result = await upcomingCampParticipantCollection.find().toArray()
            res.send(result)
        })
        app.delete('/deleteupregister/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await upcomingCampParticipantCollection.deleteOne(query)
            res.send(result)
        })
        app.put('/participantlist/:query', async (req, res) => {
            const query = req.params.query;
            const updatequery = { _id: new ObjectId(query) }
            const updatedCamp = {
                $set:
                {
                    register: true
                },
            }
            const result = await upcomingCampParticipantCollection.updateOne(updatequery, updatedCamp)

            res.send(result)
        })
        app.get('/participantlist', async (req, res) => {
            const result = await upcomingCampParticipantCollection.find().toArray()
            res.send(result)
        })
        app.get('/participantlist/:query', verifyToken, verifyOrganizer, async (req, res) => {
            const searchquery = req.params.query;
            const query = { queryNumber: searchquery };

            const result = await upcomingCampParticipantCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/participantlist', verifyToken, async (req, res) => {
            const data = req.body;
            const query = { queryNumber: data.queryNumber }
            const updatedCamp = {
                $inc:
                {
                    participators: 1,
                    interestedParticipators: 1
                },
            }
            const upcomingupdate = await upcommingCampCollection.updateOne(query, updatedCamp)
            const result = await upcomingCampParticipantCollection.insertOne(data)
            res.send({ result, upcomingupdate })
        })
        // upcomingCampParticipantCollection end


        // upcomingCampProfessionalCollection start
        app.get('/professionallist', async (req, res) => {
            const result = await upcomingCampProfessionalCollection.find().toArray()
            res.send(result)
        })
        app.get('/getacceptedCamp/:email', async (req, res) => {
            const query = { professionalEmail: req.params.email }
            queryCriteria = {
                $and: [
                    { professionalEmail: req.params.email },
                    { confirmation: true }
                ]
            };
            const result = await upcomingCampProfessionalCollection.find(queryCriteria).toArray()
            res.send(result)
        })



        app.get('/professionallist/:query', verifyToken, verifyOrganizer, async (req, res) => {
            const searchquery = req.params.query;
            const query = { queryNumber: searchquery };

            const result = await upcomingCampProfessionalCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/professionallisting/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await upcomingCampProfessionalCollection.findOne(query)
            res.send(result)
        })
        app.post('/professionallist', verifyToken, verifyProfessional, async (req, res) => {
            const data = req.body;
            const query = { queryNumber: data.queryNumber }
            const updatedCamp = {
                $inc:
                {
                    professionals: 1
                },
            }
            const upcomingupdate = await upcommingCampCollection.updateOne(query, updatedCamp)
            const result = await upcomingCampProfessionalCollection.insertOne(data)
            res.send({ result, upcomingupdate })
        })
        app.put('/professionallistupdate/:id', async (req, res) => {
            const name = req.body;
            const id = req.params.id;
            const id2 = req.body.campid
            const query = { _id: new ObjectId(id) }
            const query2 = { _id: new ObjectId(id2) }

            const updatedData = {
                $set: {
                    confirmation: true
                }
            }
            const updatedData2 = {
                $set: {
                    healthcareExpert: req.body.professionalName
                }
            }
            const updateparticipants = await upcomingCampProfessionalCollection.updateOne(query, updatedData)
            const updateparticipants2 = await upcommingCampCollection.updateOne(query2, updatedData2)
            res.send({ updateparticipants, updateparticipants2 })
        })

        // upcomingCampProfessionalCollection end



        // feedback start
        app.get('/feedback', async (req, res) => {
            const result = await feedbackCollection.find().sort({ time: -1 }).toArray();
            res.send(result)
        })
        app.post('/addfeedback', async (req, res) => {
            const body = req.body;
            const result = await feedbackCollection.insertOne(body);
            res.send(result)
        })
        app.get('/feedback/:email', verifyToken, verifyOrganizer, async (req, res) => {
            const query = { organizerEmail: req?.params?.email }
            const result = await feedbackCollection.find(query).toArray();
            res.send(result)
        })
        // feedback end

        // registrationCampCollection start
        app.get('/registrationcamps', async (req, res) => {
            const result = await registrationCampCollection.find().toArray()
            res.send(result)
        })
        app.get('/singleregisteredcamp/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { registerEmail: email }
            const result = await registrationCampCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/registrationcamps', verifyToken, async (req, res) => {
            const registrationCamp = req.body;

            const result = await registrationCampCollection.insertOne(registrationCamp)
            res.send(result)
        })
        app.delete('/deleteregisteredcamp/:campId', verifyToken, async (req, res) => {
            const id = req?.params?.campId;
            const query = { _id: new ObjectId(id) }
            const result = await registrationCampCollection.deleteOne(query)
            res.send(result)
        })
        app.put('/updateRegistrationcamp/:campId', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req?.params?.campId;
            const transactionId = req?.body?.transactionId
            console.log(transactionId);

            const paymentquery = { transactionId: transactionId }
            const query = { _id: new ObjectId(id) }
            const upatedData = {
                $set: {

                    confirmationStatus: 'confirmed'
                }
            }
            const updateregister = await registrationCampCollection.updateOne(query, upatedData)
            const updatepayment = await paymentsCollection.updateOne(paymentquery, upatedData)
            res.send({ updateregister, updatepayment })
        })
        // registrationCampCollection end
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir);
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})