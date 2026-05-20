
import mongoose from "mongoose";
import dotenv from "dotenv";
import Teacher from "./models/Teacher.js";
import Course from "./models/Course.js";

dotenv.config();

const TEACHER_USER_ID = "023-22-0092";

async function migrateCourses() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        });
        console.log("Connected.\n");

        let teacher = await Teacher.findOne({ userId: TEACHER_USER_ID });
        if (!teacher) {
            console.log(`Teacher ${TEACHER_USER_ID} not found. Please sign up first, then re-run this script.`);
            process.exit(1);
        }

        const teacherId = teacher._id;
        console.log(`Found teacher: ${teacher.name} (${teacher.userId}) → _id: ${teacherId}\n`);

        try {
            const collection = mongoose.connection.collection('courses');
            const indexes = await collection.indexes();
            const oldIndex = indexes.find(idx =>
                idx.key && idx.key.courseCode && !idx.key.teacherId && idx.unique
            );
            if (oldIndex) {
                console.log(`Dropping old unique index: ${oldIndex.name}`);
                await collection.dropIndex(oldIndex.name);
                console.log("Old index dropped successfully.");
            } else {
                console.log("No old unique courseCode-only index found (already clean).");
            }
        } catch (err) {
            console.log("Note: Could not drop old index (may not exist):", err.message);
        }

        const courseResult = await Course.updateMany(
            { teacherId: { $exists: false } },
            { $set: { teacherId } }
        );
        const courseResult2 = await Course.updateMany(
            { teacherId: null },
            { $set: { teacherId } }
        );
        console.log(`Courses: ${courseResult.modifiedCount + courseResult2.modifiedCount} updated`);

        try {
            const collection = mongoose.connection.collection('courses');
            await collection.createIndex(
                { courseCode: 1, teacherId: 1 },
                { unique: true }
            );
            console.log("New compound index (courseCode + teacherId) created successfully.");
        } catch (err) {
            console.log("Note: Compound index may already exist:", err.message);
        }

        console.log("\nCourse migration complete! All existing courses are now assigned to", TEACHER_USER_ID);

    } catch (error) {
        console.error("Migration error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

migrateCourses();
