import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../db.js';

const router = express.Router();

router.post('/login', [
    body("email").notEmpty().isEmail().withMessage("Email is required"),
    body("password").notEmpty().withMessage("Password is required")
], async (req, res) => {
    try {
        const error = validationResult(req);
        if (!error.isEmpty()) {
            return res.status(400).json({ success: false, error: error.array() });
        }
        const { email, password } = req.body;
        const database = getDatabase();
        const userCollection = database.collection("Users");
        const user = await userCollection.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: "Incorrect email or password" });
        }
        const matchedPassword = await bcrypt.compare(password, user.password);
        if (!matchedPassword) {
            return res.status(401).json({ success: false, message: "Incorrect email or password" });
        }
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role || 'Analyst' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRESIN }
        );
        return res.status(200).json({
            success: true,
            message: "Welcome",
            token,
            user: { id: user._id, name: user.name, surname: user.surname, email: user.email, role: user.role || 'Analyst' }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "internal Server Error" });
    }
});

export default router;
