const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken')
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8d3cohe.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJwt= (req,res,next)=>{
  const authHeader= req.headers.authorization
  if(!authHeader){
    return res.status(401).send({message: 'Unauthorized Access'})
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
    if(err){
      return res.send({message: 'unauthorized Access'})
    }
    req.decoded = decoded
    next()
  })
}

const run = async () => {
  try {
    const appoinmentOptionsCollection = client.db('doctorsPortal').collection('appointmentOptions')
    const bookingsCollection = client.db('doctorsPortal').collection('bookings')
    const usersCollection = client.db('doctorsPortal').collection('users')

    app.get('/appointmentOptions', async(req,res)=>{
      const date = req.query.date

        const query = {}
        const result =await appoinmentOptionsCollection.find(query).toArray()
        const bookingQuery = {appointmentDate: date}
        const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()
        result.forEach(option => {
          const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
          const bookSlots = optionBooked.map(book => book.slot)
          const remainingSlots = option.slots.filter(slot => !bookSlots.includes(slot))
          option.slots = remainingSlots
          
        })
        res.send(result)
    })

    // bookings

    app.get('/bookings', verifyJwt, async(req, res)=>{
      
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({message: 'Forbidded Access'})
      }
      const query = {email: email}
      const bookings = await bookingsCollection.find(query).toArray()
      res.send(bookings)
    })

    app.post('/bookings', async(req,res)=>{
        const booking = req.body
        const query = {
          appointmentDate: booking.appointmentDate,
          email: booking.email,
          treatment: booking.treatment
        }
        const alreadyBooked = await bookingsCollection.find(query).toArray()
        if(alreadyBooked.length){
          const message = `You have already booking on ${booking.appointmentDate}`
          return res.send({acknowledged: false, message})
        }
        const result = await bookingsCollection.insertOne(booking)
        res.send(result)
    })

    app.get('/jwt',async(req,res)=>{
      const email = req.query.email;
      const query = {email: email}
      const user=await usersCollection.findOne(query)
      if(user){
        const token = jwt.sign({email}, process.env.ACCESS_TOKEN,{expiresIn: '1d'})
        return res.send({accessToken: token})
      }
      res.status(401).send({message:'Unauthorized Access'})
    })


      app.post('/users',async(req,res)=>{
        const user = req.body
        const result =await usersCollection.insertOne(user)
        res.send(result)
      })

      app.get('/users',async(req,res)=>{
        const query = {}
        const users = await usersCollection.find(query).toArray()
        res.send(users)
      })

      app.put('/users/admin/:id',verifyJwt, async(req,res)=>{
        const decodedEmail = req.decoded.email;
        const query = {email: decodedEmail}
        const user = await usersCollection.findOne(query)
        if(user?.role !== 'admin'){
          return res.status(403).send({message: 'forbidden access'})
        }
        const id = req.params.id;
        const filter = {_id: ObjectId(id)}
        const options = {upsert: true}
        const updatedDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await usersCollection.updateOne(filter, updatedDoc, options)
        res.send(result)
      })

  } finally {
  }
};
run().catch((e) => console.log(e.message));

app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
