import StickerIcon from '@hugeicons/core-free-icons/StickerIcon'
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon'
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon'
import BookOpen01Icon from '@hugeicons/core-free-icons/BookOpen01Icon'
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon'
import Calculator01Icon from '@hugeicons/core-free-icons/Calculator01Icon'
import Call02Icon from '@hugeicons/core-free-icons/Call02Icon'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import CodeIcon from '@hugeicons/core-free-icons/CodeIcon'
import Comment01Icon from '@hugeicons/core-free-icons/Comment01Icon'
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon'
import GameController01Icon from '@hugeicons/core-free-icons/GameController01Icon'
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon'
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon'
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon'
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon'
import Notification03Icon from '@hugeicons/core-free-icons/Notification03Icon'
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon'
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon'
import RepeatIcon from '@hugeicons/core-free-icons/RepeatIcon'
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon'
import SentIcon from '@hugeicons/core-free-icons/SentIcon'
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon'
import Share08Icon from '@hugeicons/core-free-icons/Share08Icon'
import Sun03Icon from '@hugeicons/core-free-icons/Sun03Icon'
import TextFontIcon from '@hugeicons/core-free-icons/TextFontIcon'
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon'
import TrophyIcon from '@hugeicons/core-free-icons/TrophyIcon'
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon'
import Video01Icon from '@hugeicons/core-free-icons/Video01Icon'
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon'
import ViewOffIcon from '@hugeicons/core-free-icons/ViewOffIcon'
import ZapIcon from '@hugeicons/core-free-icons/ZapIcon'

export const glyphs = {
  home:Home01Icon, book:BookOpen01Icon, search:Search01Icon, game:GameController01Icon,
  plus:PlusSignIcon, bell:Notification03Icon, msg:BubbleChatIcon, cm:Comment01Icon,
  heart:FavouriteIcon, heartOn:FavouriteIcon, rp:RepeatIcon, sh:Share08Icon,
  back:ArrowLeft01Icon, close:Cancel01Icon, moon:Moon02Icon, sun:Sun03Icon,
  image:Image01Icon, vid:Video01Icon, ph:Call02Icon, grp:UserGroupIcon,
  settings:Settings02Icon, check:Tick02Icon, arrow:ArrowRight01Icon,
  gift:GiftIcon, bolt:ZapIcon, trophy:TrophyIcon, maths:Calculator01Icon,
  type:TextFontIcon, code:CodeIcon, eye:ViewIcon, eyeOff:ViewOffIcon,
  play:PlayIcon, send:SentIcon, sticker:StickerIcon,
}
export type Glyph = keyof typeof glyphs
export type IconRendererProps = {icon: typeof Home01Icon; size:number; color:string; strokeWidth:number; fill?:string}
