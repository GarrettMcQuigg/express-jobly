"use strict";

const db = require("../db");
const {
  BadRequestError,
  NotFoundError,
  ExpressError,
} = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

class Jobs {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { id, title, salary, equity, company_handle }
   *
   * Returns { id, title, salary, equity, company_handle }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create(data) {
    const result = await db.query(
      `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, salary, equity, company_handle AS "companyHandle"`,
      [data.title, data.salary, data.equity, data.companyHandle]
    );
    const job = result.rows[0];

    return job;
  }

  /** Find all jobs.
   *
   * Returns [{ searchFilter }, ...]
   * -title
   * -minSalary
   * -hasEquity (Boolean)
   * */

  static async findAll(searchFilters = {}) {
    let query = `
     SELECT title, 
            salary, 
            equity, 
            company_handle AS "companyHandle",
     FROM jobs`;

    let queryVal = [];
    let whereExp = [];

    const { title, minSalary, hasEquity } = searchFilters;

    if (minSalary < 0) {
      throw new ExpressError("Invalid Constraints", 400);
    }

    if (minSalary !== undefined) {
      queryVal.push(minSalary);
      whereExp.push(`salary >= $${queryVal.length}`);
    }

    if (hasEquity === true) {
      whereExp.push(`equity > 0`);
    }

    if (title !== undefined) {
      queryVal.push(`%${title}%`);
      whereExp.push(`title ILIKE $${queryVal.length}`);
    }

    if (whereExp.length > 0) {
      query += " WHERE " + whereExp.join(" AND ");
    }

    query += ` ORDER BY title`;
    const jobRes = await db.query(query, queryVal);
    return jobRes.rows;
  }

  /** Given a job id, return data about job.
   *
   * Returns { id, title, salary, equity, company_handle }
   *     where company is { handle, name, description, numEmployees, logoUrl }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const jobRes = await db.query(
      `SELECT id,
        title, 
        salary, 
        equity, 
        company_handle AS "companyHandle"
             FROM jobs
             WHERE id = $1`,
      [id]
    );

    const job = jobRes.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    const companyRes = await db.query(
      `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies
           WHERE handle = $1`,
      [job.companyHandle]
    );

    delete job.companyHandle;
    job.company = companyRes.rows[0];

    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {title, 
        salary, 
        equity, 
        company_handle}
   *
   * Returns {id, 
   *    title, 
        salary, 
        equity, 
        company_handle}
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(data);

    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id, 
                           title, 
                           salary, 
                           equity, 
                           company_handle AS companyHandle`;
    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No company: ${id}`);

    return job;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(id) {
    const result = await db.query(
      `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
      [id]
    );
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
  }
}

module.exports = Jobs;
