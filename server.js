// server.js
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
const port = 5000;

app.use(bodyParser.json());
app.use(cors());

// MySQL Configuration
const db = mysql.createConnection({
  host: "127.0.0.1",
  port: "3306",
  user: "root",
  password: "",
  database: "surveyapp",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to the database!");
});

app.get("/api/surveys", (req, res) => {
  const sql = "SELECT * FROM surveys";
  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching surveys:", err);
      return res.status(500).json({ message: "Error fetching surveys" });
    }

    res.json(result);
  });
});

// API to fetch survey questions and options
app.get("/api/surveys/:surveyId", (req, res) => {
  const surveyId = req.params.surveyId;
  const sql = `
    SELECT s.id, s.title, s.description, q.id AS question_id, q.text AS question_text, o.id AS option_id, o.text AS option_text
    FROM surveys s
    LEFT JOIN questions q ON s.id = q.survey_id
    LEFT JOIN options o ON q.id = o.question_id
    WHERE s.id = ?;
  `;

  db.query(sql, [surveyId], (err, result) => {
    if (err) {
      console.error("Error fetching survey:", err);
      return res.status(500).json({ message: "Error fetching survey" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const survey = {
      id: result[0].id,
      title: result[0].title,
      description: result[0].description,
      questions: [],
    };

    result.forEach((row) => {
      const question = survey.questions.find((q) => q.id === row.question_id);
      if (!question) {
        survey.questions.push({
          id: row.question_id,
          text: row.question_text,
          options: [],
        });
      }

      const option = {
        id: row.option_id,
        text: row.option_text,
      };

      const questionIndex = survey.questions.findIndex(
        (q) => q.id === row.question_id
      );
      survey.questions[questionIndex].options.push(option);
    });

    res.json(survey);
  });
});

// API to submit survey responses
app.post("/api/surveys/:surveyId/response", (req, res) => {
  const surveyId = req.params.surveyId;
  const { responses, uniqueSubmitId } = req.body;

  const responseValues = Object.entries(responses).map(
    ([questionId, optionId]) => [uniqueSubmitId, surveyId, questionId, optionId]
  );
  const responseSql = `INSERT INTO responses (unique_submit_id ,survey_id, question_id, option_id) VALUES ?`;

  db.query(responseSql, [responseValues], (err) => {
    if (err) {
      console.error("Error submitting survey response:", err);
      return res
        .status(500)
        .json({ message: "Error submitting survey response" });
    }

    res.json({ message: "Survey response submitted successfully" });
  });
});

app.get("/api/surveys/:surveyId/responses/:uniqueSubmitId", (req, res) => {
  const surveyId = req.params.surveyId;
  const uniqueSubmitId = req.params.uniqueSubmitId;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 10;
  const offset = (page - 1) * pageSize;

  const countSql = `SELECT COUNT(*) AS total FROM responses WHERE survey_id = ? AND unique_submit_id = ?`;
  db.query(countSql, [surveyId, uniqueSubmitId], (err, result) => {
    if (err) {
      console.error("Error fetching response count:", err);
      return res.status(500).json({ message: "Error fetching response count" });
    }

    const totalCount = result[0].total;

    const responseSql = `
      SELECT r.id, r.question_id, q.text, r.option_id, o.text AS option_text
      FROM responses r
      INNER JOIN options o ON r.option_id = o.id
      INNER JOIN questions q ON r.question_id = q.id
      WHERE r.survey_id = ? AND r.unique_submit_id = ? 
      ORDER BY r.id DESC
      LIMIT ? OFFSET ?;
    `;

    db.query(
      responseSql,
      [surveyId, uniqueSubmitId, Number(pageSize), Number(offset)],
      (err, result) => {
        if (err) {
          console.error("Error fetching responses:", err);
          return res.status(500).json({ message: "Error fetching responses" });
        }

        const responses = result.map((row) => ({
          id: row.id,
          question: row.question_id,
          question_text: row.text,
          option: row.option_id,
          option_text: row.option_text,
        }));

        res.json({ responses, totalCount });
      }
    );
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
