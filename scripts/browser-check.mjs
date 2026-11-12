import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'

const browser=await chromium.launch({
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args:process.env.TEST_BROWSER_ARGS?JSON.parse(process.env.TEST_BROWSER_ARGS):[],
})
const base=process.env.TEST_WEB_URL??'http://localhost:5173'
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'})
const errors=[]
page.on('pageerror',error=>errors.push(error))
const button=(name)=>page.getByRole('button',{name,exact:true})
const text=(value)=>page.getByText(value,{exact:true})
const visible=async(locator)=>locator.waitFor({timeout:6000})
const openDemo=async()=>{
  await button('Skip').click()
  await button('Explore demo').click()
  await visible(text('Finally cracked quadratic equations! Made a one-page cheat sheet for the class.'))
}
try{
  await page.goto(base+'/?demo=1')
  await visible(text('Hang out. Learn. Have fun.'))
  await button('Continue').click()
  await visible(text('Your crew, your space'))
  await button('Continue').click()
  await visible(text('Play and win'))
  await button('Get started').click()
  await visible(button('Create account'))
  await button('Explore demo').click()
  await visible(text('Finally cracked quadratic equations! Made a one-page cheat sheet for the class.'))
  await button('Like post').first().click()
  await visible(button('Unlike post'))
  await button('Comments').first().click()
  await page.getByLabel('Add a comment',{exact:true}).fill('Love the maths notes.')
  await button('Post comment').click()
  await visible(text('Love the maths notes.'))
  await button('Close').click()
  await button('Create post').click()
  await page.getByLabel('What’s happening?',{exact:true}).fill('Group study at 4.')
  await button('Publish post').click()
  await visible(text('Group study at 4.'))
  await button('Explore').click()
  await page.getByLabel('Search',{exact:true}).fill('Tobi')
  await visible(text('Tobi A.'))
  await button('Follow').click()
  await visible(button('Following'))
  await page.getByLabel('Search',{exact:true}).fill('does not exist')
  await visible(text('No results'))
  await button('Messages').click()
  await button('Open conversation with Ada O.').click()
  await page.getByLabel('Message',{exact:true}).fill('What time is the quiz?')
  await button('Send').click()
  await visible(text('What time is the quiz?'))
  await visible(text('Thanks for the message! See you at school.'))
  await button('Voice call').click()
  await visible(text('Voice call preview'))
  await button('Mute').click()
  await visible(button('Unmute'))
  await button('End call').click()
  await button('Go back').click()
  await button('Go back').click()
  await button('Learn').click()
  await button('Start').click()
  for (const answer of ['4','29','25']){
    await button(answer).click()
    await visible(text('Correct!'))
    await button(answer==='25'?'See results':'Next question').click()
  }
  await visible(text('You earned 120 XP'))
  await button('Done').click()
  await button('Toggle light or dark mode').click()
  await page.setViewportSize({width:1280,height:800})
  await button('Home').click()
  await visible(text('Study room'))
  assert.deepEqual(errors,[])

  await page.goto(base+'/')
  await button('Skip').click()
  await page.getByLabel('First name',{exact:true}).fill('Browser')
  await page.getByLabel('Last name',{exact:true}).fill('QA')
  await page.getByLabel('Username',{exact:true}).fill('browser_'+Date.now())
  const runId=Date.now()
  const email='browser-'+runId+'@example.test'
  const postBody='Persisted browser post '+runId
  await page.getByLabel('Email',{exact:true}).fill(email)
  await page.getByLabel('Password',{exact:true}).fill('browser-passphrase-42')
  await button('Create account').click()
  await visible(button('Your profile'))
  await page.reload()
  await visible(button('Your profile'))
  await button('Create post').click()
  await page.getByLabel('What’s happening?',{exact:true}).fill(postBody)
  await button('Publish post').click()
  await visible(text(postBody))
  await page.reload()
  await visible(text(postBody))
  await button('Your profile').click()
  await button('Settings').click()
  await button('Log out').click()
  await visible(button('Create account'))
  assert.deepEqual(errors,[])
  if(process.env.TEST_PREVIEWS_DIR){
    for(const file of ['dameeland-web-preview.html','dameeland-mobile-preview.html']){
      await page.setViewportSize(file.includes('mobile')?{width:390,height:844}:{width:1280,height:800})
      await page.goto(pathToFileURL(resolve(process.env.TEST_PREVIEWS_DIR,file)).href)
      await visible(text('Hang out. Learn. Have fun.'))
      await openDemo()
      await button('Like post').first().click()
      await visible(button('Unlike post'))
    }
    assert.deepEqual(errors,[])
    console.log('Both offline previews loaded and handled feed interactions.')
  }
  console.log('Chromium passed desktop and 390px interaction tests, including live signup, restore, posting, and logout.')
}finally{await browser.close()}
