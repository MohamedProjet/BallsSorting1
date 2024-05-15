var express = require('express');
var router = express.Router();
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')

const port = "COM12"

const arduino = new SerialPort({
  path: port,
  baudRate: 9600
})

arduino.on('error', (err)=>{
  console.log(err);
})

const etat = {
  lastTimestamp: 0,
  lastAcquisition: NaN,
  idle: true,
  etatbp: 0
}

let currentSession = null

const parser = arduino.pipe(new ReadlineParser({ delimiter: '\r\n' }))

parser.on('data', (data)=>{
  etat.lastTimestamp = new Date()
  etat.lastAcquisition = Number(data.toString())
  if(etat.idle === false && currentSession){
    prisma.measure.create({ data: {
      time: etat.lastTimestamp,
      idColor: etat.lastAcquisition,
      idSession: currentSession.id
    }}).then()
  }
})


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {  });
});

router.get('/Home', function(req, res, next) {
  res.render('Home', {  });
});

router.get('/log', async (req, res, next)=> {
  const sessions = await prisma.session.findMany()
  res.render('historic', { sessions: sessions })
})

router.get('/about', function(req, res, next) {
  res.render('about', {  });
});

router.post('/api/getSessionValues', (req, res, next)=>{
  const idSession = Number(req.body.idSession)
  prisma.measure.findMany({
    where: {
      idSession: idSession
    }
  }).then(val=>{
    res.status(200).json(val)
  })
})


router.post('/api/start', (req, res, next)=>{
  if(etat.idle === true){
    etat.idle=false
    startLogging()
    res.status(200).send()
  } else {
    res.status(403).send()
  }
})

router.post('/api/stop', (req, res, next)=>{
  if(etat.idle === false){
    etat.idle=true
    stopLogging()
    res.status(200).send()
  } else {
    res.status(403).send()
  }
  
})

router.post('/api/state', (req, res, next)=>{
  res.status(200).json(etat)
})
router.post('/api/reset', (req, res, next) => {
  // Réinitialiser les compteurs et l'interface utilisateur
  pinkCount = 0;
  yellowCount = 0;
  otherCount = 0;
  
  // Envoyer une réponse JSON indiquant que la réinitialisation a réussi
  res.json({ message: 'Reset successful' });
});

async function startLogging(){
  // Creer une nouvelle session
  currentSession = await prisma.session.create({})
  console.log(currentSession);
}

function stopLogging(){
  // Arreter la session en cours
  prisma.session.update({
    where: {
      id: currentSession.id
    },
    data: {
      stop: new Date()
    }
  }).then((v)=> {
    currentSession = null
    console.log('Session '+ v.id + ' closed');
  })
}

module.exports = router;
