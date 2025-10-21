const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;

let users = JSON.parse(fs.readFileSync('./data/users.json'));

// Signup
app.post('/signup',(req,res)=>{
    const {username,password} = req.body;
    if(users[username]) return res.status(400).json({error:'User exists'});
    const hash = bcrypt.hashSync(password,10);
    users[username]={password:hash,twoFA:false};
    fs.writeFileSync('./data/users.json',JSON.stringify(users,null,2));
    res.json({success:true});
});

// Login
app.post('/login',(req,res)=>{
    const {username,password} = req.body;
    const user = users[username];
    if(!user) return res.status(400).json({error:'No such user'});
    if(!bcrypt.compareSync(password,user.password)) return res.status(400).json({error:'Wrong password'});
    res.json({success:true,twoFA:user.twoFA});
});

// WebSocket signaling
const server = app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
const wss = new WebSocket.Server({server});

let peers = {};
wss.on('connection',ws=>{
    ws.on('message',message=>{
        const data = JSON.parse(message);
        if(data.type==='register') peers[data.username]=ws;
        if(data.type==='signal'){
            const target = peers[data.target];
            if(target) target.send(JSON.stringify({type:'signal',from:data.from,signal:data.signal}));
        }
    });
    ws.on('close',()=>{ for(let u in peers) if(peers[u]===ws) delete peers[u]; });
});
