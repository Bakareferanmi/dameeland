export const subjects=['Mathematics','English','Digital Technologies'] as const
export type Subject=typeof subjects[number]
type Lesson={
  id:string
  subject:Subject
  title:string
  notes:string[]
  question:string
  options:string[]
  answer:number
  explanation:string
}

export const lessons:Lesson[]=[
  {id:'quadratics',subject:'Mathematics',title:'Factorising quadratics',
    notes:['A quadratic equation has a highest power of 2. To factorise x² + bx + c, look for two numbers that add to b and multiply to c.',
      'For x² + 5x + 6, the numbers are 2 and 3. Write (x + 2)(x + 3). If the expression equals zero, either factor can be zero, so x = −2 or x = −3.'],
    question:'What are the roots of x² + 7x + 12 = 0?',options:['−3 and −4','3 and 4','−2 and −6'],answer:0,
    explanation:'3 and 4 add to 7 and multiply to 12. Setting (x + 3)(x + 4) to zero gives −3 and −4.'},
  {id:'agreement',subject:'English',title:'Subject–verb agreement',
    notes:['The main verb agrees with the subject. In the present tense, a singular third-person subject usually takes an -s verb, as in “She reads.” A plural subject takes the base form, as in “They read.”',
      'Ignore intervening phrases when finding the subject. In “The box of pencils is missing,” box is the subject. Pencils belongs to a phrase that describes the box.'],
    question:'Which verb completes “The list of names ___ on the board”?',options:['are','is','were'],answer:1,
    explanation:'List is singular, so the sentence takes “is.”'},
  {id:'binary',subject:'Digital Technologies',title:'Binary place value',
    notes:['Binary uses two digits, 0 and 1. From right to left, the place values are 1, 2, 4, 8, 16 and so on. Each place is worth twice the one to its right.',
      'To convert 1011 to decimal, add the places marked 1. That gives 8 + 2 + 1 = 11. The 4 place contributes zero.'],
    question:'What is 1101 in decimal?',options:['11','12','13'],answer:2,
    explanation:'The marked places are 8, 4 and 1, which add to 13.'},
  {id:'percentages',subject:'Mathematics',title:'Percentage change',
    notes:['Find the difference between the new and original values. Divide that difference by the original value, then multiply by 100 to express the change as a percentage.',
      'A price that rises from ₦800 to ₦1,000 goes up by ₦200. Divide 200 by 800 and multiply by 100 to get a 25% increase.'],
    question:'A price falls from ₦2,000 to ₦1,500. What is the percentage decrease?',options:['20%','25%','33⅓%'],answer:1,
    explanation:'The price fell by ₦500. Divide 500 by the original ₦2,000 to get 0.25, or 25%.'},
  {id:'main-idea',subject:'English',title:'Finding the main idea',
    notes:['The main idea is the central point a writer makes about a topic. Supporting details explain, illustrate or give evidence for that point.',
      'To test your answer, ask whether it covers most of the paragraph. When the writer tells you how compost reduces waste and improves soil, the main idea covers both benefits.'],
    question:'A paragraph explains that walking saves money and helps people stay active. What is its main idea?',options:['Shoes are expensive','Walking has practical and health benefits','Exercise needs a gym'],answer:1,
    explanation:'Saving money and staying active both support the broader point that walking has benefits.'},
  {id:'algorithms',subject:'Digital Technologies',title:'Algorithms and decisions',
    notes:['An algorithm is an ordered set of steps for solving a problem. A decision chooses which steps to take based on whether a condition is true.',
      'A grading algorithm might test whether a score is at least 50. If it is, the program displays “Pass.” Otherwise, it displays “Try again.”'],
    question:'What does the grading algorithm display for a score of exactly 50?',options:['Pass','Try again','No result'],answer:0,
    explanation:'“At least 50” includes 50. The condition is true.'},
  {id:'linear-equations',subject:'Mathematics',title:'Solving linear equations',
    notes:['An equation stays balanced when you do the same thing to both sides. Undo addition or subtraction first, then undo multiplication or division.',
      'To solve 3x + 4 = 19, subtract 4 from both sides to get 3x = 15. Divide both sides by 3 to get x = 5.'],
    question:'Solve 2x − 3 = 11.',options:['4','7','8'],answer:1,
    explanation:'Add 3 to get 2x = 14, then divide by 2.'},
  {id:'punctuation',subject:'English',title:'Punctuation in lists',
    notes:['Use commas to separate three or more items in a list. A colon can introduce a list after a complete clause.',
      '“Bring these supplies: a pen, a notebook and a ruler” works because “Bring these supplies” can stand on its own.'],
    question:'Which mark can introduce a list after a complete clause?',options:['Question mark','Apostrophe','Colon'],answer:2,
    explanation:'A colon signals that the list explains or expands the preceding clause.'},
  {id:'spreadsheets',subject:'Digital Technologies',title:'Spreadsheet formulas',
    notes:['A spreadsheet formula begins with an equals sign. A range such as B2:B5 includes the cells from B2 through B5.',
      'SUM adds values. AVERAGE adds the numeric values and divides by how many numeric values are in the range.'],
    question:'Which formula calculates the mean of cells B2 through B5?',options:['=SUM(B2:B5)','=AVERAGE(B2:B5)','=B2+B5'],answer:1,
    explanation:'AVERAGE uses every numeric value in the range and divides the total by their count.'},
]

export const dailyLesson=(time=Date.now())=>lessons[Math.floor((time+3600000)/86400000)%lessons.length]
