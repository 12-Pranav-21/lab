const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const md5 = require("md5");
const _ = require("lodash");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const findOrCreate = require("mongoose-findorcreate");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// 🔴 ImageMagick invocation
const { execFile } = require("child_process");

const app = express();
const PORT = 8080;
const URL = "mongodb://localhost:27017/userdb";

//////////////////// MongoDB ////////////////////
mongoose.connect(URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

//////////////////// Multer Storage ////////////////////
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userName = req.user ? req.user.username : "anonymous";
    const dir = path.join(__dirname, "Public", "uploads", userName);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage: storage });

//////////////////// Middlewares ////////////////////
app.use(express.static("Public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "this is the secret.",
    resave: false,
    saveUninitialized: false
  })
);

app.use(passport.initialize());
app.use(passport.session());

//////////////////// Schemas ////////////////////
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  mobNo: Number,
  birthday: String,
  password: String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = mongoose.model("User", userSchema);

const poemSchema = new mongoose.Schema({
  topic: String,
  body: String,
  image: String,
  auth: String,
  cat: String
});
const Poem = mongoose.model("POEM", poemSchema);

passport.use(User.createStrategy());
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => done(err, user));
});

//////////////////// Auth Routes ////////////////////
app.get("/register", (req, res) => res.render("register"));
app.get("/login", (req, res) => res.render("login"));

app.post("/register", (req, res) => {
  const newUser = new User({
    username: req.body.userName,
    email: req.body.userEmail,
    mobNo: req.body.mobNo,
    birthday: req.body.dob,
    password: md5(req.body.password)
  });

  newUser.save(() => res.render("logined"));
});

app.post("/login", (req, res) => {
  User.findOne({ email: req.body.userName }, (err, userfound) => {
    if (userfound && userfound.password === md5(req.body.password)) {
      req.login(userfound, () => res.render("logined"));
    } else {
      res.send("<h1>Invalid credentials</h1>");
    }
  });
});

//////////////////// Main Routes ////////////////////
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

app.get("/poems", (req, res) => {
  Poem.find({}, (err, poems) => {
    res.render("poems", { para: poems });
  });
});

app.get("/post", (req, res) => res.render("post"));

//////////////////// 🔥 VULNERABLE IMAGE PROCESSING ////////////////////
app.post("/post", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.send("No image uploaded");
  }

  const userName = req.user ? req.user.username : "anonymous";
  const inputPath = req.file.path;

  // 🔴 ImageMagick processes USER-CONTROLLED IMAGE
  execFile("convert", [inputPath, "-resize", "800x800", inputPath], (err) => {
    if (err) {
      console.log("ImageMagick error:", err);
    }

    const imagePath = `/uploads/${userName}/${req.file.filename}`;

    const poem = new Poem({
      topic: req.body.topic,
      body: req.body.body,
      image: imagePath,
      auth: req.body.auth,
      cat: req.body.cat
    });

    poem.save(() => res.render("posted"));
  });
});

app.get("/poems/:PoemId", (req, res) => {
  Poem.findOne({ _id: req.params.PoemId }, (err, poem) => {
    if (poem)
      res.render("rpoem", {
        topic: poem.topic,
        body: poem.body,
        image: poem.image,
        auth: poem.auth
      });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
