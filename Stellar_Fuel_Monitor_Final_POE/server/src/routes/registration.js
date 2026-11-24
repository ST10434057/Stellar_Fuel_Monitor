import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../db.js';

const router = express.Router();

router.post('/register', [
    body("name").notEmpty().withMessage("Name is required"),
    body("surname").notEmpty().withMessage("Surname is required"),
    body("email").trim().notEmpty().isEmail().withMessage("Email is required"),
    body("password").notEmpty().withMessage("Password is required")
        .isLength({ min: 8, max: 20 }).withMessage("Password must be between 8 and 20 characters")
        .matches(/[A-Z]/).withMessage("Uppercase is required")
        .matches(/[0-9]/).withMessage("A digit is required")
        .matches(/[^A-Za-z0-9]/).withMessage("Special character is required")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { name, surname, email, password } = req.body;
        const database = getDatabase();
        const userCollection = database.collection("Users");
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Email already exist in the Database" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { name, surname, email: email.toLowerCase(), password: hashedPassword, role: 'Analyst', createdAt: new Date() };
        await userCollection.insertOne(newUser);
        return res.status(201).json({
            success: true,
            message: "User registration Successful",
            user: { name, surname, email }
        });
    } catch (err) {
        console.error("Registration Failed. Error:", err);
        return res.status(500).json({ success: false, message: "internal Server error occurred" });
    }
});

export default router;
