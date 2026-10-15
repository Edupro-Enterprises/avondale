export function Figure({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className='my-4'>
      <img src={src} alt={alt} className='w-full rounded-lg border' />
      {caption && <figcaption className='mt-2 text-center text-xs text-muted-foreground'>{caption}</figcaption>}
    </figure>
  )
}
