export const shapes=['●','▲','■','★','✚'] as const
export type Shape=typeof shapes[number]
export type PlayingCard={shape:Shape|'Wild';rank:number}
export type Match={hands:[PlayingCard[],PlayingCard[]];deck:PlayingCard[];pile:PlayingCard[];shape:Shape;turn:0|1;winner?:0|1}

function shuffle(cards:PlayingCard[]){
  const result=[...cards]
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1))
    ;[result[i],result[j]]=[result[j],result[i]]
  }
  return result
}

export function start():Match{
  const deck=shuffle([
    ...shapes.flatMap(shape=>[1,2,3,4,5,7,8,10,11,12,13,14].map(rank=>({shape,rank}))),
    ...Array.from({length:4},():PlayingCard=>({shape:'Wild',rank:20})),
  ])
  const index=deck.findIndex(card=>card.shape!=='Wild')
  const [top]=deck.splice(index,1)
  return {hands:[deck.splice(0,5),deck.splice(0,5)],deck,pile:[top],shape:top.shape as Shape,turn:0}
}

export function legal(match:Match,card:PlayingCard){
  return card.shape==='Wild'||card.shape===match.shape||card.rank===match.pile[0].rank
}

export function play(match:Match,index:number,chosen?:Shape):Match{
  const {turn}=match
  const card=match.hands[turn][index]
  if(match.winner!==undefined||!card||!legal(match,card)||card.shape==='Wild'&&!chosen)return match
  const hands:[PlayingCard[],PlayingCard[]]=[...match.hands]
  hands[turn]=hands[turn].filter((_,i)=>i!==index)
  return {...match,hands,pile:[card,...match.pile],shape:card.shape==='Wild'?chosen!:card.shape,
    turn:turn===0?1:0,winner:hands[turn].length===0?turn:undefined}
}

export function draw(match:Match):Match{
  const {turn}=match
  if(match.winner!==undefined)return match
  const recycling=!match.deck.length
  const [card,...deck]=recycling?shuffle(match.pile.slice(1)):match.deck
  const hands:[PlayingCard[],PlayingCard[]]=[...match.hands]
  if(card)hands[turn]=[...hands[turn],card]
  return {...match,hands,deck,pile:recycling?match.pile.slice(0,1):match.pile,turn:turn===0?1:0}
}
