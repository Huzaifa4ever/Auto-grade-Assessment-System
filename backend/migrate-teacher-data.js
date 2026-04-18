
import mongoose from "mongoose";
import dotenv from "dotenv";
import Teacher from "./models/Teacher.js";
import Paper from "./models/Paper.js";
import StudentCopy from "./models/StudentCopy.js";
import EvaluationResult from "./models/EvaluationResult.js";
import StudentTable from "./models/StudentCsv.js";

dotenv.config();

const TEACHER_USER_ID = "023-22-0092";
const TEACHER_NAME = "Huzaifa Abid";

async function migrate() {
    try {
        console.log("Connecting to MongoDB...");
        console.log("URI:", process.env.MONGO_URI ? "Found" : "MISSING!");
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        });
        console.log("Connected.\n");

        // Find or verify the teacher
        let teacher = await Teacher.findOne({ userId: TEACHER_USER_ID });
        if (!teacher) {
            console.log(`Teacher ${TEACHER_USER_ID} not found. Please sign up first, then re-run this script.`);
            process.exit(1);
        }

        const teacherId = teacher._id;
        console.log(`Found teacher: ${teacher.name} (${teacher.userId}) → _id: ${teacherId}\n`);

        // Migrate Papers
        const paperResult = await Paper.updateMany(
            { teacherId: { $exists: false } },
            { $set: { teacherId } }
        );
        // Also update documents where teacherId is null
        const paperResult2 = await Paper.updateMany(
            { teacherId: null },
            { $set: { teacherId } }
        );
        console.log(`Papers: ${paperResult.modifiedCount + paperResult2.modifiedCount} updated`);

        // Migrate StudentCopy
        const copyResult = await StudentCopy.updateMany(
            { teacherId: { $exists: false } },
            { $set: { teacherId } }
        );
        const copyResult2 = await StudentCopy.updateMany(
            { teacherId: null },
            { $set: { teacherId } }
        );
        console.log(`StudentCopies: ${copyResult.modifiedCount + copyResult2.modifiedCount} updated`);

        //Migrate EvaluationResult
        const evalResult = await EvaluationResult.updateMany(
            { teacherId: { $exists: false } },
            { $set: { teacherId } }
        );
        const evalResult2 = await EvaluationResult.updateMany(
            { teacherId: null },
            { $set: { teacherId } }
        );
        console.log(`EvaluationResults: ${evalResult.modifiedCount + evalResult2.modifiedCount} updated`);

        // Migrate StudentTable (StudentCsv)
        const tableResult = await StudentTable.updateMany(
            { teacherId: { $exists: false } },
            { $set: { teacherId } }
        );
        const tableResult2 = await StudentTable.updateMany(
            { teacherId: null },
            { $set: { teacherId } }
        );
        console.log(`StudentTables: ${tableResult.modifiedCount + tableResult2.modifiedCount} updated`);

        console.log("\n Migration complete! All existing data is now assigned to", TEACHER_USER_ID);

    } catch (error) {
        console.error("Migration error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

migrate();
