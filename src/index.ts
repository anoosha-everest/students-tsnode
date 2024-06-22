import nconf from 'nconf';
import * as fs from 'fs';
import csvParser from 'csv-parser';
import path from 'path';

interface MasterData {
  SubjectName: string;
  TotalMarks: number;
  PassPercentage: number;
}

interface StudentMarks {
  StudentName: string;
  SubjectName: string;
  MarksObtained: number;
}

const report: {
  [studentName: string]: {
    totalMarks: number,
    totalPercentage: number,
    subjectCount:number,
    subjects: {
      [subjectName: string]: string
    },
    result:string
  }
} = {};

const highestMarks: {
  [subjectName: string]: {
    marks: number;
    students: string[];
  }
} = {};

let highSub:string;
let lowSub:string;



// Load configuration
nconf.argv().env().file({ file: path.join(__dirname, '../config.json') });


// Read student, subject name from command line
const studentName = process.argv[2] || nconf.get('studentName');
const subjectName = process.argv[3] || nconf.get('subjectName');

// if (!studentName) {
//   console.error('Usage: ts-node src/index.ts <studentName>');
//   process.exit(1);
// }

const readCSV = <T>(filePath: string): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results as T[]))
      .on('error', (error) => reject(error));
  });
};

const generateReport = (masterData: MasterData[], studentMarks: StudentMarks[]) => {
          interface data{
            TotalMarks: number;
            PassPercentage: number;
          }
          const masterMap: Map<string, data> = new Map();
            masterData.forEach(rec => {
              masterMap.set(rec.SubjectName, { TotalMarks: rec.TotalMarks, PassPercentage: rec.PassPercentage });
            });
          studentMarks.forEach(studentMark => {
            const { StudentName, SubjectName, MarksObtained } = studentMark;

            if (!report[StudentName]) {
              report[StudentName] = { totalMarks: 0, totalPercentage: 0, subjectCount: 0 ,subjects:{},result:''};
            }
            if (!highestMarks[SubjectName] || highestMarks[SubjectName].marks < MarksObtained) {
              highestMarks[SubjectName] = { marks: MarksObtained, students: [StudentName] };
            } else if (highestMarks[SubjectName].marks === MarksObtained) {
              highestMarks[SubjectName].students.push(StudentName);
            }
            report[StudentName].totalMarks+=MarksObtained;
            report[StudentName].subjectCount+=1;
            const masterdata=masterMap.get(SubjectName);

            if(masterdata!=undefined){
              const { TotalMarks, PassPercentage } = masterdata;
              const subjectPercentage = (MarksObtained / TotalMarks) * 100;

              // Check if the student passed the subject
              if (subjectPercentage >= PassPercentage) {
                report[StudentName].totalPercentage += subjectPercentage;
                report[StudentName].subjects[SubjectName]='Pass';
              }
              else{
                report[StudentName].subjects[SubjectName]='Fail';
              }
            }

          });

          for (const studentName in report) {
            const repo = report[studentName];
            const overallPercentage = parseFloat(((repo.totalMarks / (repo.subjectCount * 100)) * 100).toFixed(2));
            report[studentName].totalPercentage=overallPercentage;
            repo.result = (repo.subjectCount >= 5 && overallPercentage >= 40) ? 'Pass' : 'Fail';
          }
          if (!lowSub && !lowSub){
            highSub='';
            lowSub='';
          }
          
          let highper=-Infinity;
          let lowper=Infinity;
          masterData.forEach(student=>{
              if(student.PassPercentage>highper){
                highper=student.PassPercentage;
                highSub=student.SubjectName;
              }
              if(student.PassPercentage<lowper){
                lowper=student.PassPercentage;
                lowSub=student.SubjectName;
              }
          });
          console.log(`Report of the student: ${studentName}`);
          console.log(report[studentName] ? report[studentName] : `No data found for student: ${studentName}`);
         
}

const StudentsFailed = () => {
    let failed_students:string[]=[];
    let cnt=0;
    Object.keys(report).forEach(studentName => {
       if(report[studentName].result==='Fail'){
        cnt++;
        failed_students.push(studentName);
       }
    });
    console.log('total students failed=',cnt,failed_students);
}

const main = async () => {
  try {
    // Get configuration values
    const masterDataPath = nconf.get('masterDataPath');
    const studentMarksPath = nconf.get('studentMarksPath');
    

    if (!masterDataPath || !studentMarksPath) {
      throw new Error('masterDataPath and studentMarksPath must be specified in the config file');
    }

    const masterData = await readCSV<MasterData>(masterDataPath);
    const studentMarks = await readCSV<StudentMarks>(studentMarksPath);

    masterData.forEach((data) => {
      data.TotalMarks = Number(data.TotalMarks);
      data.PassPercentage = Number(data.PassPercentage);
    });
    studentMarks.forEach((data) => {
      data.MarksObtained = Number(data.MarksObtained);
    });

    generateReport(masterData, studentMarks);
    StudentsFailed();
  
    console.log(`list of students who got highest marks in ${subjectName} subject:`);
    console.log(highestMarks[subjectName]);
    console.log("highest pass percentage subject=",highSub);
    console.log("lowest pass percentage subject=",lowSub);
  } catch (error) {
    console.error('Error processing CSV files:', error);
  }
};

main();

//npx ts-node src/index.ts path/to/MasterData.csv path/to/StudentMarks.csv John Maths

