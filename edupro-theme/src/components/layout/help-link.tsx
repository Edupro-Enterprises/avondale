import { Link } from '@tanstack/react-router'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** The one entry point from every role shell into the /help knowledge
 * base -- without this, /help is only reachable by typing the URL
 * directly. Shared by DeskHeader (Bursar/School Head/SDC/System Admin)
 * and PortalLayout (Parent/Student) so every role gets it the same way. */
export function HelpLink() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant='ghost' size='icon' className='scale-95 rounded-full' asChild>
          <Link to='/help'>
            <HelpCircle className='size-[1.2rem]' />
            <span className='sr-only'>Knowledge Base</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Knowledge Base</TooltipContent>
    </Tooltip>
  )
}
